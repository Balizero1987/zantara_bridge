import type { Router, Request, Response } from 'express';
import { uploadTextAsDoc, createDriveFolder } from '../../services/driveUpload';

// Predefined templates for Bali Zero business
const BUSINESS_TEMPLATES = {
  'client-consultation': {
    title: 'Client Consultation Notes',
    content: `# Client Consultation - [CLIENT NAME]

**Date**: ${new Date().toISOString().split('T')[0]}
**Consultant**: [CONSULTANT NAME]
**Client**: [CLIENT NAME]
**Contact**: [EMAIL/PHONE]

## Meeting Overview
**Duration**: [TIME]
**Type**: [KITAS/KITAP/PT PMA/Tax Consultation/Other]
**Status**: [New Client/Follow-up/Renewal]

## Client Requirements
### Primary Needs:
- [ ] KITAS Application/Renewal
- [ ] KITAP Application  
- [ ] PT PMA Setup
- [ ] Tax Compliance
- [ ] Work Permit
- [ ] Other: ___________

### Specific Details:
**Nationality**: 
**Current Status**: 
**Intended Duration**: 
**Business Activity**: 

## Documents Required
- [ ] Passport copy
- [ ] CV/Resume
- [ ] Educational certificates
- [ ] Bank statements
- [ ] Investment proof
- [ ] Other: ___________

## Action Items
| Task | Responsible | Due Date | Status |
|------|-------------|----------|--------|
|      |             |          |        |

## Follow-up
**Next Meeting**: 
**Timeline**: 
**Expected Completion**: 

## Notes
[Additional consultation notes]

---
Generated: ${new Date().toISOString()}
Template: client-consultation
Consultant: [NAME]`
  },
  
  'compliance-checklist': {
    title: 'Indonesia Compliance Checklist',
    content: `# Indonesia Compliance Checklist

**Client**: [CLIENT NAME]
**Period**: [MONTH/YEAR]
**Review Date**: ${new Date().toISOString().split('T')[0]}

## KITAS/KITAP Compliance
- [ ] Valid KITAS/KITAP (Check expiry: _____)
- [ ] Re-entry permit valid
- [ ] Address registration (Domicile letter)
- [ ] Annual reporting completed
- [ ] Extension application filed (if applicable)

## Work Permit Compliance  
- [ ] Valid work permit
- [ ] IMTA (Izin Mempekerjakan Tenaga Asing)
- [ ] RPTKA (Rencana Penggunaan Tenaga Kerja Asing)
- [ ] Position/role matches permit
- [ ] Salary compliance check

## Tax Compliance
- [ ] NPWP (Tax ID) registered
- [ ] Monthly tax filings (PPh 21)
- [ ] Annual tax return (SPT)
- [ ] Tax payments up to date
- [ ] Withholding tax compliance

## PT PMA Compliance (if applicable)
- [ ] Company registration current
- [ ] Foreign investment license
- [ ] Business license (NIB)
- [ ] Environmental permits
- [ ] Board resolution updates

## Banking & Finance
- [ ] Bank account compliance
- [ ] Foreign exchange reporting
- [ ] Investment documentation
- [ ] Repatriation records

## Documentation Status
| Document | Status | Expiry Date | Action Required |
|----------|--------|-------------|-----------------|
| KITAS    |        |             |                 |
| Work Permit |     |             |                 |
| NPWP     |        | N/A         |                 |
| Company License | |             |                 |

## Compliance Score
**Overall Status**: [Green/Yellow/Red]
**Critical Items**: [COUNT]
**Due Soon**: [COUNT]

## Action Plan
1. **Immediate** (This week):
2. **Short-term** (This month):  
3. **Long-term** (Next quarter):

## Notes
[Compliance observations and recommendations]

---
Generated: ${new Date().toISOString()}
Template: compliance-checklist
Reviewed by: [CONSULTANT]`
  },
  
  'meeting-notes': {
    title: 'Team Meeting Notes',
    content: `# Team Meeting Notes

**Date**: ${new Date().toISOString().split('T')[0]}
**Time**: [START] - [END]
**Meeting Type**: [Daily Standup/Weekly Review/Client Review/Project Planning]
**Attendees**: [LIST]

## Agenda
1. [AGENDA ITEM 1]
2. [AGENDA ITEM 2]
3. [AGENDA ITEM 3]

## Discussion Points

### [TOPIC 1]
**Discussion**: 
**Decisions**: 
**Action Items**: 

### [TOPIC 2]  
**Discussion**:
**Decisions**:
**Action Items**:

## Action Items Summary
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
|        |       |          |        |

## Decisions Made
- [DECISION 1]
- [DECISION 2]

## Next Steps
- [NEXT STEP 1]
- [NEXT STEP 2]

## Next Meeting
**Date**: 
**Focus**: 
**Agenda Items**: 

---
Generated: ${new Date().toISOString()}
Template: meeting-notes
Meeting Lead: [NAME]`
  },
  
  'client-onboarding': {
    title: 'Client Onboarding Checklist',
    content: `# Client Onboarding Process

**Client Name**: [FULL NAME]
**Date Started**: ${new Date().toISOString().split('T')[0]}
**Service Type**: [KITAS/KITAP/PT PMA/Tax/Multiple]
**Account Manager**: [NAME]

## Client Information
**Full Name**: 
**Nationality**: 
**Email**: 
**Phone**: 
**Current Location**: 
**Intended Location**: Indonesia

## Service Details
**Primary Service**: 
**Secondary Services**: 
**Timeline**: 
**Budget Range**: 
**Urgency Level**: [Low/Medium/High/Critical]

## Initial Documentation
- [ ] Passport copy received
- [ ] CV/Resume received  
- [ ] Educational certificates
- [ ] Work experience letters
- [ ] Financial documents
- [ ] Investment proof (if applicable)
- [ ] Marriage certificate (if applicable)
- [ ] Birth certificates (dependents)

## Legal Setup
- [ ] Service agreement signed
- [ ] Payment terms agreed
- [ ] Retainer payment received
- [ ] Client portal access created
- [ ] Communication preferences set

## Process Initiation
- [ ] Case file created
- [ ] Government applications started
- [ ] Document translations initiated
- [ ] Apostille/legalization arranged
- [ ] Local bank account guidance provided

## Timeline & Milestones
| Milestone | Target Date | Status | Notes |
|-----------|-------------|--------|-------|
| Document collection | | | |
| Government submission | | | |
| Approval received | | | |
| Process completion | | | |

## Communication Log
**Initial Consultation**: [DATE]
**Regular Updates**: [FREQUENCY]
**Next Contact**: [DATE]

## Special Requirements
[Any special considerations or requirements]

## Notes
[Onboarding notes and observations]

---
Generated: ${new Date().toISOString()}
Template: client-onboarding
Account Manager: [NAME]`
  },
  
  'expense-report': {
    title: 'Monthly Expense Report',
    content: `# Monthly Expense Report

**Period**: [MONTH YEAR]
**Submitted by**: [NAME]
**Department**: [DEPARTMENT]
**Submission Date**: ${new Date().toISOString().split('T')[0]}

## Expense Summary
**Total Amount**: IDR [AMOUNT]
**Categories**: [COUNT]
**Receipts**: [COUNT] attached

## Expense Categories

### Travel & Transportation
| Date | Description | Amount (IDR) | Receipt |
|------|-------------|--------------|---------|
|      |             |              |         |
**Subtotal**: IDR [AMOUNT]

### Client Entertainment
| Date | Client | Description | Amount (IDR) | Receipt |
|------|--------|-------------|--------------|---------|
|      |        |             |              |         |
**Subtotal**: IDR [AMOUNT]

### Office Supplies
| Date | Item | Vendor | Amount (IDR) | Receipt |
|------|------|--------|--------------|---------|
|      |      |        |              |         |
**Subtotal**: IDR [AMOUNT]

### Professional Services
| Date | Service | Provider | Amount (IDR) | Receipt |
|------|---------|----------|--------------|---------|
|      |         |          |              |         |
**Subtotal**: IDR [AMOUNT]

### Other Expenses  
| Date | Description | Category | Amount (IDR) | Receipt |
|------|-------------|----------|--------------|---------|
|      |             |          |              |         |
**Subtotal**: IDR [AMOUNT]

## Reimbursement Details
**Bank Account**: [ACCOUNT NUMBER]
**Bank Name**: [BANK]
**Account Holder**: [NAME]

## Approval
**Immediate Supervisor**: [NAME]
**Date Approved**: 
**Finance Approval**: [NAME]
**Date Processed**: 

## Notes
[Additional expense notes or explanations]

---
Generated: ${new Date().toISOString()}
Template: expense-report
Submitted by: [NAME]`
  }
};

export default function registerTemplates(r: Router) {
  
  // Get available templates
  r.get('/api/templates', async (req: Request, res: Response) => {
    try {
      const templates = Object.keys(BUSINESS_TEMPLATES).map(key => ({
        id: key,
        title: BUSINESS_TEMPLATES[key].title,
        description: getTemplateDescription(key),
        category: getTemplateCategory(key),
        lastUpdated: new Date().toISOString()
      }));
      
      res.json({
        success: true,
        templates,
        categories: ['Client Management', 'Compliance', 'Team Collaboration', 'Finance'],
        total: templates.length
      });
      
    } catch (error: any) {
      console.error('Templates list error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve templates',
        details: error.message 
      });
    }
  });
  
  // Create document from template
  r.post('/api/templates/create', async (req: Request, res: Response) => {
    try {
      const { 
        templateId, 
        userId = 'user',
        customTitle,
        variables = {},
        saveToFolder = 'personal'
      } = req.body;
      
      if (!templateId || !BUSINESS_TEMPLATES[templateId]) {
        return res.status(400).json({ error: 'Invalid template ID' });
      }
      
      const template = BUSINESS_TEMPLATES[templateId];
      let content = template.content;
      
      // Replace variables in template
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\[${key.toUpperCase()}\\]`, 'g');
        content = content.replace(regex, variables[key]);
      });
      
      // Generate document title
      const timestamp = new Date().toISOString().split('T')[0];
      const docTitle = customTitle || `${template.title}_${timestamp}`;
      
      // Determine folder (personal or shared)
      const folderPrefix = saveToFolder === 'shared' ? 'SHARED_TEMPLATES' : userId.toUpperCase();
      
      // Create document
      const document = await uploadTextAsDoc(content, docTitle, folderPrefix);
      
      res.json({
        success: true,
        message: 'Document created from template',
        document: {
          title: docTitle,
          templateUsed: templateId,
          webViewLink: document.webViewLink,
          fileId: document.fileId,
          folder: saveToFolder,
          createdFor: userId
        },
        variables: variables
      });
      
    } catch (error: any) {
      console.error('Template creation error:', error);
      res.status(500).json({ 
        error: 'Failed to create document from template',
        details: error.message 
      });
    }
  });
  
  // Get template preview
  r.get('/api/templates/:templateId/preview', async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      
      if (!BUSINESS_TEMPLATES[templateId]) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      const template = BUSINESS_TEMPLATES[templateId];
      
      res.json({
        success: true,
        template: {
          id: templateId,
          title: template.title,
          content: template.content,
          variables: extractVariables(template.content),
          description: getTemplateDescription(templateId),
          category: getTemplateCategory(templateId)
        }
      });
      
    } catch (error: any) {
      console.error('Template preview error:', error);
      res.status(500).json({ 
        error: 'Failed to get template preview',
        details: error.message 
      });
    }
  });
  
  // Create custom template
  r.post('/api/templates/custom', async (req: Request, res: Response) => {
    try {
      const { 
        title,
        content,
        category = 'Custom',
        userId = 'admin',
        isShared = false
      } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content required' });
      }
      
      // Create template document
      const templateDoc = await uploadTextAsDoc(
        content,
        `TEMPLATE_${title.replace(/\s+/g, '_')}`,
        isShared ? 'SHARED_TEMPLATES' : userId.toUpperCase()
      );
      
      res.json({
        success: true,
        message: 'Custom template created',
        template: {
          title,
          category,
          webViewLink: templateDoc.webViewLink,
          fileId: templateDoc.fileId,
          isShared,
          createdBy: userId,
          variables: extractVariables(content)
        }
      });
      
    } catch (error: any) {
      console.error('Custom template error:', error);
      res.status(500).json({ 
        error: 'Failed to create custom template',
        details: error.message 
      });
    }
  });
}

// Helper functions
function getTemplateDescription(templateId: string): string {
  const descriptions = {
    'client-consultation': 'Structured notes for client meetings and consultations',
    'compliance-checklist': 'Comprehensive compliance checklist for Indonesia regulations',
    'meeting-notes': 'Standard template for team meeting documentation',
    'client-onboarding': 'Complete checklist for new client onboarding process',
    'expense-report': 'Monthly expense report with categorized tracking'
  };
  return descriptions[templateId] || 'Business template';
}

function getTemplateCategory(templateId: string): string {
  const categories = {
    'client-consultation': 'Client Management',
    'compliance-checklist': 'Compliance',
    'meeting-notes': 'Team Collaboration',
    'client-onboarding': 'Client Management',
    'expense-report': 'Finance'
  };
  return categories[templateId] || 'General';
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\[([A-Z_\s]+)\]/g);
  if (!matches) return [];
  
  return [...new Set(matches.map(match => 
    match.replace(/[\[\]]/g, '').toLowerCase().replace(/\s+/g, '_')
  ))];
}