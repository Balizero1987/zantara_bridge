import json
import os
from datetime import datetime
from flask import Flask, request, jsonify
from google.cloud import firestore, pubsub_v1, secretmanager, storage

app = Flask(__name__)

# Initialize Google Cloud clients
project_id = os.getenv('PROJECT_ID')
pubsub_topic = os.getenv('PUBSUB_TOPIC')
firestore_db = firestore.Client(project=project_id)
pubsub_publisher = pubsub_v1.PublisherClient()
secret_client = secretmanager.SecretManagerServiceClient()
storage_client = storage.Client(project=project_id)

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
    return {"status": "healthy", "service": "zantara-orchestrator"}, 200

@app.route('/briefing', methods=['POST'])
def receive_briefing():
    """Receive briefing and orchestrate tasks"""
    try:
        data = request.get_json()
        if not data or 'briefing' not in data:
            return {"error": "Missing briefing in request"}, 400
        
        briefing = data['briefing']
        user_id = data.get('user_id', 'anonymous')
        
        # Create task breakdown
        tasks = create_task_breakdown(briefing)
        
        # Store in Firestore
        session_id = store_session(briefing, tasks, user_id)
        
        # Publish tasks to Pub/Sub
        published_tasks = []
        for task in tasks:
            task_id = publish_task(session_id, task)
            published_tasks.append({
                "task_id": task_id,
                "description": task['description'],
                "type": task['type']
            })
        
        return {
            "session_id": session_id,
            "status": "tasks_created",
            "total_tasks": len(tasks),
            "tasks": published_tasks
        }, 200
        
    except Exception as e:
        app.logger.error(f"Error processing briefing: {e}")
        return {"error": "Internal server error"}, 500

def create_task_breakdown(briefing):
    """Break down briefing into tasks"""
    # Simple task breakdown - in a real system this would use AI
    tasks = [
        {
            "type": "analysis",
            "description": f"Analyze briefing: {briefing[:100]}...",
            "priority": "high",
            "estimated_duration": 300  # 5 minutes
        },
        {
            "type": "research",
            "description": "Gather relevant information and context",
            "priority": "medium",
            "estimated_duration": 600  # 10 minutes
        },
        {
            "type": "execution",
            "description": "Execute main task requirements",
            "priority": "high",
            "estimated_duration": 900  # 15 minutes
        }
    ]
    return tasks

def store_session(briefing, tasks, user_id):
    """Store session data in Firestore"""
    session_data = {
        "briefing": briefing,
        "user_id": user_id,
        "created_at": firestore.SERVER_TIMESTAMP,
        "status": "active",
        "tasks": tasks,
        "total_tasks": len(tasks),
        "completed_tasks": 0
    }
    
    doc_ref = firestore_db.collection('sessions').add(session_data)
    return doc_ref[1].id

def publish_task(session_id, task):
    """Publish task to Pub/Sub"""
    topic_path = pubsub_publisher.topic_path(project_id, pubsub_topic)
    
    task_data = {
        "session_id": session_id,
        "task": task,
        "created_at": datetime.utcnow().isoformat(),
        "status": "pending"
    }
    
    message = json.dumps(task_data).encode("utf-8")
    future = pubsub_publisher.publish(topic_path, message)
    
    # Store task in Firestore
    task_doc = firestore_db.collection('tasks').add({
        "session_id": session_id,
        "task_data": task_data,
        "status": "published",
        "created_at": firestore.SERVER_TIMESTAMP
    })
    
    return task_doc[1].id

@app.route('/session/<session_id>/status', methods=['GET'])
def get_session_status(session_id):
    """Get session status"""
    try:
        doc_ref = firestore_db.collection('sessions').document(session_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return {"error": "Session not found"}, 404
        
        session_data = doc.to_dict()
        
        # Get task status
        tasks_ref = firestore_db.collection('tasks').where('session_id', '==', session_id)
        tasks = [task.to_dict() for task in tasks_ref.stream()]
        
        return {
            "session_id": session_id,
            "status": session_data.get('status'),
            "briefing": session_data.get('briefing'),
            "total_tasks": len(tasks),
            "tasks": tasks,
            "created_at": session_data.get('created_at')
        }, 200
        
    except Exception as e:
        app.logger.error(f"Error getting session status: {e}")
        return {"error": "Internal server error"}, 500

@app.route('/tasks/complete', methods=['POST'])
def complete_task():
    """Mark task as completed"""
    try:
        data = request.get_json()
        task_id = data.get('task_id')
        result = data.get('result', {})
        
        if not task_id:
            return {"error": "Missing task_id"}, 400
        
        # Update task status
        task_ref = firestore_db.collection('tasks').document(task_id)
        task_ref.update({
            "status": "completed",
            "result": result,
            "completed_at": firestore.SERVER_TIMESTAMP
        })
        
        return {"status": "task_completed", "task_id": task_id}, 200
        
    except Exception as e:
        app.logger.error(f"Error completing task: {e}")
        return {"error": "Internal server error"}, 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, host='0.0.0.0', port=port)