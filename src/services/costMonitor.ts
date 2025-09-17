import { Firestore } from '@google-cloud/firestore';
import { firestore as getFirestore } from '../firebase';

interface ApiUsageEntry {
  id: string;
  timestamp: Date;
  service: 'openai' | 'claude' | 'google';
  endpoint: string;
  userId: string;
  tokensUsed: number;
  estimatedCost: number;
  model?: string;
  metadata?: Record<string, any>;
}

interface CostAlert {
  id: string;
  userId: string;
  threshold: number;
  currentSpend: number;
  period: 'daily' | 'weekly' | 'monthly';
  triggered: boolean;
  lastAlertAt?: Date;
}

export class CostMonitor {
  private firestore: Firestore;
  private readonly USAGE_COLLECTION = 'api_usage';
  private readonly ALERTS_COLLECTION = 'cost_alerts';
  
  // Pricing per 1K tokens (approximate, update as needed)
  private readonly PRICING = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 }
  };

  constructor() {
    this.firestore = getFirestore;
  }

  /**
   * Track API usage
   */
  async trackUsage(params: {
    service: 'openai' | 'claude' | 'google';
    endpoint: string;
    userId: string;
    tokensUsed: number;
    model?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const estimatedCost = this.calculateCost(
      params.model || 'gpt-4',
      params.tokensUsed,
      'input' // Simplified, could be enhanced
    );

    const entry: ApiUsageEntry = {
      id: `${params.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      service: params.service,
      endpoint: params.endpoint,
      userId: params.userId,
      tokensUsed: params.tokensUsed,
      estimatedCost,
      model: params.model,
      metadata: params.metadata
    };

    await this.firestore
      .collection(this.USAGE_COLLECTION)
      .doc(entry.id)
      .set(entry);

    // Check alerts
    await this.checkAlerts(params.userId);
  }

  /**
   * Calculate cost based on model and tokens
   */
  private calculateCost(
    model: string,
    tokens: number,
    type: 'input' | 'output'
  ): number {
    const pricing = this.PRICING[model as keyof typeof this.PRICING];
    if (!pricing) {
      // Default to GPT-4 pricing if model not found
      return (tokens / 1000) * this.PRICING['gpt-4'][type];
    }
    return (tokens / 1000) * pricing[type];
  }

  /**
   * Get usage statistics for a user
   */
  async getUserStats(
    userId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<{
    totalCost: number;
    totalTokens: number;
    byService: Record<string, number>;
    byModel: Record<string, number>;
    dailyBreakdown: Array<{ date: string; cost: number; tokens: number }>;
  }> {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    const snapshot = await this.firestore
      .collection(this.USAGE_COLLECTION)
      .where('userId', '==', userId)
      .where('timestamp', '>=', startDate)
      .get();

    let totalCost = 0;
    let totalTokens = 0;
    const byService: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const dailyData: Record<string, { cost: number; tokens: number }> = {};

    for (const doc of snapshot.docs) {
      const entry = doc.data() as ApiUsageEntry;
      
      totalCost += entry.estimatedCost;
      totalTokens += entry.tokensUsed;
      
      // By service
      byService[entry.service] = (byService[entry.service] || 0) + entry.estimatedCost;
      
      // By model
      if (entry.model) {
        byModel[entry.model] = (byModel[entry.model] || 0) + entry.estimatedCost;
      }
      
      // Daily breakdown
      const dateKey = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { cost: 0, tokens: 0 };
      }
      dailyData[dateKey].cost += entry.estimatedCost;
      dailyData[dateKey].tokens += entry.tokensUsed;
    }

    const dailyBreakdown = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCost,
      totalTokens,
      byService,
      byModel,
      dailyBreakdown
    };
  }

  /**
   * Set cost alert for a user
   */
  async setAlert(
    userId: string,
    threshold: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    const alert: CostAlert = {
      id: `${userId}_${period}`,
      userId,
      threshold,
      currentSpend: 0,
      period,
      triggered: false
    };

    await this.firestore
      .collection(this.ALERTS_COLLECTION)
      .doc(alert.id)
      .set(alert);
  }

  /**
   * Check and trigger alerts
   */
  private async checkAlerts(userId: string): Promise<void> {
    const alertsSnapshot = await this.firestore
      .collection(this.ALERTS_COLLECTION)
      .where('userId', '==', userId)
      .get();

    for (const doc of alertsSnapshot.docs) {
      const alert = doc.data() as CostAlert;
      
      let periodDays = 1;
      switch (alert.period) {
        case 'weekly':
          periodDays = 7;
          break;
        case 'monthly':
          periodDays = 30;
          break;
      }
      
      const stats = await this.getUserStats(
        userId,
        alert.period === 'daily' ? 'day' : alert.period === 'weekly' ? 'week' : 'month'
      );
      
      if (stats.totalCost >= alert.threshold) {
        if (!alert.triggered || this.shouldReAlert(alert.lastAlertAt)) {
          await this.triggerAlert(alert, stats.totalCost);
        }
      } else if (alert.triggered) {
        // Reset alert if spending is back below threshold
        await this.firestore
          .collection(this.ALERTS_COLLECTION)
          .doc(alert.id)
          .update({
            triggered: false,
            currentSpend: stats.totalCost
          });
      }
    }
  }

  /**
   * Trigger cost alert
   */
  private async triggerAlert(alert: CostAlert, currentSpend: number): Promise<void> {
    console.warn(`⚠️ COST ALERT: User ${alert.userId} has spent $${currentSpend.toFixed(2)} (threshold: $${alert.threshold})`);
    
    // Update alert status
    await this.firestore
      .collection(this.ALERTS_COLLECTION)
      .doc(alert.id)
      .update({
        triggered: true,
        currentSpend,
        lastAlertAt: new Date()
      });

    // Here you could send email, Slack notification, etc.
    // For now, just log it
  }

  /**
   * Check if we should re-alert (e.g., every 24 hours)
   */
  private shouldReAlert(lastAlertAt?: Date): boolean {
    if (!lastAlertAt) return true;
    
    const hoursSinceLastAlert = 
      (new Date().getTime() - new Date(lastAlertAt).getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastAlert >= 24;
  }

  /**
   * Get cost projection
   */
  async getProjection(
    userId: string,
    daysAhead: number = 30
  ): Promise<{
    projectedCost: number;
    currentDailyAverage: number;
    recommendedDailyBudget: number;
  }> {
    const stats = await this.getUserStats(userId, 'month');
    
    if (stats.dailyBreakdown.length === 0) {
      return {
        projectedCost: 0,
        currentDailyAverage: 0,
        recommendedDailyBudget: 0
      };
    }

    const currentDailyAverage = stats.totalCost / stats.dailyBreakdown.length;
    const projectedCost = currentDailyAverage * daysAhead;
    
    // Recommend 80% of current average as budget (conservative)
    const recommendedDailyBudget = currentDailyAverage * 0.8;

    return {
      projectedCost,
      currentDailyAverage,
      recommendedDailyBudget
    };
  }

  /**
   * Export usage data for billing
   */
  async exportUsageData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ApiUsageEntry[]> {
    const snapshot = await this.firestore
      .collection(this.USAGE_COLLECTION)
      .where('userId', '==', userId)
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as ApiUsageEntry);
  }
}

// Singleton instance
export const costMonitor = new CostMonitor();