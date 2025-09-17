import json
import os
import time
from datetime import datetime
from flask import Flask, request, jsonify
from google.cloud import firestore, pubsub_v1, secretmanager
from concurrent.futures import ThreadPoolExecutor
import threading

app = Flask(__name__)

# Initialize Google Cloud clients
project_id = os.getenv('PROJECT_ID')
pubsub_subscription = os.getenv('PUBSUB_SUBSCRIPTION')
firestore_db = firestore.Client(project=project_id)
pubsub_subscriber = pubsub_v1.SubscriberClient()
secret_client = secretmanager.SecretManagerServiceClient()

# Global flag for shutdown
shutdown_flag = threading.Event()

def get_secret(secret_id):
    """Get secret from Secret Manager"""
    try:
        name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
        response = secret_client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        app.logger.error(f"Error accessing secret {secret_id}: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "zantara-light-agent"}, 200

def process_task(task_data):
    """Process a single task"""
    try:
        task = task_data.get('task', {})
        session_id = task_data.get('session_id')
        task_type = task.get('type')
        description = task.get('description')
        
        app.logger.info(f"Processing {task_type} task: {description}")
        
        # Simulate task processing based on type
        result = {}
        
        if task_type == 'analysis':
            result = {
                "analysis": f"Analyzed: {description}",
                "findings": ["Key point 1", "Key point 2", "Key point 3"],
                "confidence": 0.85
            }
            time.sleep(2)  # Simulate processing time
            
        elif task_type == 'research':
            result = {
                "research_summary": f"Research completed for: {description}",
                "sources": ["Source 1", "Source 2", "Source 3"],
                "data_points": 15
            }
            time.sleep(3)  # Simulate processing time
            
        elif task_type == 'execution':
            result = {
                "execution_status": "completed",
                "output": f"Executed: {description}",
                "metrics": {
                    "success_rate": 0.95,
                    "processing_time": 5.2
                }
            }
            time.sleep(5)  # Simulate processing time
            
        else:
            result = {
                "status": "completed",
                "message": f"Processed generic task: {description}"
            }
            time.sleep(1)
        
        # Store result in Firestore
        result_doc = {
            "session_id": session_id,
            "task_data": task_data,
            "result": result,
            "processed_by": "light-agent",
            "processed_at": firestore.SERVER_TIMESTAMP,
            "status": "completed"
        }
        
        firestore_db.collection('task_results').add(result_doc)
        
        app.logger.info(f"Task completed: {task_type}")
        return result
        
    except Exception as e:
        app.logger.error(f"Error processing task: {e}")
        # Store error result
        error_doc = {
            "session_id": task_data.get('session_id'),
            "task_data": task_data,
            "error": str(e),
            "processed_by": "light-agent",
            "processed_at": firestore.SERVER_TIMESTAMP,
            "status": "error"
        }
        firestore_db.collection('task_results').add(error_doc)
        return {"error": str(e)}

def callback(message):
    """Pub/Sub message callback"""
    try:
        # Parse the message
        task_data = json.loads(message.data.decode('utf-8'))
        
        # Process the task
        result = process_task(task_data)
        
        # Acknowledge the message
        message.ack()
        
        app.logger.info(f"Message processed and acknowledged")
        
    except Exception as e:
        app.logger.error(f"Error processing message: {e}")
        message.nack()

def start_subscriber():
    """Start the Pub/Sub subscriber"""
    if not pubsub_subscription:
        app.logger.warning("No Pub/Sub subscription configured")
        return
    
    subscription_path = pubsub_subscriber.subscription_path(project_id, pubsub_subscription)
    
    # Configure flow control
    flow_control = pubsub_v1.types.FlowControl(max_messages=10)
    
    app.logger.info(f"Starting subscriber on {subscription_path}")
    
    # Start pulling messages
    streaming_pull_future = pubsub_subscriber.subscribe(
        subscription_path, 
        callback=callback,
        flow_control=flow_control
    )
    
    try:
        # Keep the subscriber running until shutdown
        while not shutdown_flag.is_set():
            time.sleep(1)
    except KeyboardInterrupt:
        app.logger.info("Subscriber interrupted")
    finally:
        streaming_pull_future.cancel()

@app.route('/process', methods=['POST'])
def process_direct_task():
    """Process a task directly via HTTP"""
    try:
        data = request.get_json()
        
        if not data:
            return {"error": "No data provided"}, 400
        
        result = process_task(data)
        
        return {
            "status": "completed",
            "result": result,
            "processed_at": datetime.utcnow().isoformat()
        }, 200
        
    except Exception as e:
        app.logger.error(f"Error processing direct task: {e}")
        return {"error": str(e)}, 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get agent statistics"""
    try:
        # Get task results count
        results_ref = firestore_db.collection('task_results').where('processed_by', '==', 'light-agent')
        results = list(results_ref.stream())
        
        completed = len([r for r in results if r.to_dict().get('status') == 'completed'])
        errors = len([r for r in results if r.to_dict().get('status') == 'error'])
        
        return {
            "agent": "light-agent",
            "total_tasks_processed": len(results),
            "completed_tasks": completed,
            "error_tasks": errors,
            "success_rate": completed / len(results) if results else 0,
            "uptime": "running"
        }, 200
        
    except Exception as e:
        app.logger.error(f"Error getting stats: {e}")
        return {"error": str(e)}, 500

# Start subscriber in background thread
def init_subscriber():
    """Initialize the subscriber in a background thread"""
    subscriber_thread = threading.Thread(target=start_subscriber, daemon=True)
    subscriber_thread.start()
    app.logger.info("Pub/Sub subscriber started in background")

if __name__ == '__main__':
    # Start the subscriber
    init_subscriber()
    
    # Start the Flask app
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, host='0.0.0.0', port=port)
else:
    # When running with gunicorn, start subscriber
    init_subscriber()