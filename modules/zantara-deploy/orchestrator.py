#!/usr/bin/env python3
"""
Zantara Multi-Agent Orchestrator
FastAPI service per coordinare agenti distribuiti
"""
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os, time, json, logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict
import uuid

# Cloud integrations
try:
    from google.cloud import pubsub_v1, firestore, logging as cloud_logging
    from google.cloud.exceptions import NotFound
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False

try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

from secrets_manager import SecretsManager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize secrets and config
secrets = SecretsManager()
config = secrets.get_config()

# Validate required configuration
if not secrets.validate_config():
    logger.error("Missing required configuration. Check .env or Secret Manager")
    exit(1)

app = FastAPI(
    title="Zantara Orchestrator",
    description="Multi-Agent Task Orchestration System",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In produzione, specifica domini precisi
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Cloud clients (lazy initialization)
_publisher = None
_firestore_client = None

def get_publisher():
    global _publisher
    if _publisher is None and GOOGLE_CLOUD_AVAILABLE:
        _publisher = pubsub_v1.PublisherClient()
    return _publisher

def get_firestore():
    global _firestore_client
    if _firestore_client is None and GOOGLE_CLOUD_AVAILABLE:
        _firestore_client = firestore.Client(project=config['GOOGLE_CLOUD_PROJECT'])
    return _firestore_client

# Rate limiting storage
monthly_usage = defaultdict(int)
daily_usage = defaultdict(int)

class RateLimiter:
    """Gestisce rate limiting mensile e giornaliero"""
    
    @staticmethod
    def check_limits() -> bool:
        now = datetime.now()
        month_key = now.strftime("%Y-%m")
        day_key = now.strftime("%Y-%m-%d")
        
        monthly_limit = config.get('MONTHLY_LIMIT', 10000)
        daily_limit = config.get('DAILY_LIMIT', 500)
        
        if monthly_usage[month_key] >= monthly_limit:
            raise HTTPException(429, f"Monthly limit exceeded ({monthly_limit})")
        
        if daily_usage[day_key] >= daily_limit:
            raise HTTPException(429, f"Daily limit exceeded ({daily_limit})")
        
        return True
    
    @staticmethod
    def increment_usage():
        now = datetime.now()
        month_key = now.strftime("%Y-%m")
        day_key = now.strftime("%Y-%m-%d")
        
        monthly_usage[month_key] += 1
        daily_usage[day_key] += 1

# Authentication
def verify_api_key(x_api_key: str = Header(...)):
    """Verifica API key negli headers"""
    expected_key = config.get('X_API_KEY')
    if not expected_key or x_api_key != expected_key:
        raise HTTPException(401, "Invalid API key")
    return x_api_key

def verify_jwt_token(authorization: str = Header(...)):
    """Verifica JWT token per agenti"""
    if not JWT_AVAILABLE:
        logger.warning("JWT not available, skipping token verification")
        return None
    
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "Invalid authorization header")
        
        token = authorization.split(" ")[1]
        jwt_secret = config.get('JWT_SECRET', 'your-secret-key')
        
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# Task management
class TaskManager:
    """Gestisce creazione e distribuzione dei task"""
    
    @staticmethod
    def create_run_id() -> str:
        """Genera un run_id unico"""
        return f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
    
    @staticmethod
    def parse_briefing(data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Converte un briefing in lista di task specifici"""
        briefing_text = data.get('briefing', '')
        priority = data.get('priority', 'normal')
        
        # Parsing intelligente del briefing
        tasks = []
        
        if 'code' in briefing_text.lower() or 'programming' in briefing_text.lower():
            tasks.append({
                'type': 'code_generation',
                'description': briefing_text,
                'agent': 'codex',
                'priority': priority,
                'estimated_time': 300
            })
        
        if 'test' in briefing_text.lower():
            tasks.append({
                'type': 'testing',
                'description': f"Create tests for: {briefing_text}",
                'agent': 'test_runner',
                'priority': priority,
                'estimated_time': 180
            })
        
        if 'deploy' in briefing_text.lower() or 'cloud' in briefing_text.lower():
            tasks.append({
                'type': 'deployment',
                'description': briefing_text,
                'agent': 'cloud_deployer',
                'priority': priority,
                'estimated_time': 120
            })
        
        # Default task se non matches specifici
        if not tasks:
            tasks.append({
                'type': 'general',
                'description': briefing_text,
                'agent': 'general_agent',
                'priority': priority,
                'estimated_time': 240
            })
        
        return tasks
    
    @staticmethod
    def publish_tasks(run_id: str, tasks: List[Dict[str, Any]]) -> bool:
        """Pubblica task su Pub/Sub"""
        publisher = get_publisher()
        if not publisher:
            logger.warning("Pub/Sub not available, tasks not published")
            return False
        
        project_id = config.get('GOOGLE_CLOUD_PROJECT')
        topic_name = config.get('PUBSUB_TOPIC', 'zantara-tasks')
        
        try:
            topic_path = publisher.topic_path(project_id, topic_name)
            
            for i, task in enumerate(tasks):
                task_message = {
                    'run_id': run_id,
                    'task_id': f"{run_id}_task_{i}",
                    'task': task,
                    'timestamp': datetime.now().isoformat()
                }
                
                message_data = json.dumps(task_message).encode('utf-8')
                future = publisher.publish(topic_path, message_data)
                
                logger.info(f"Published task {task_message['task_id']} to {topic_name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish tasks: {e}")
            return False

# Storage
class StorageManager:
    """Gestisce salvataggio risultati in Firestore"""
    
    @staticmethod
    def save_run(run_id: str, briefing_data: Dict[str, Any], tasks: List[Dict[str, Any]]) -> bool:
        """Salva informazioni del run in Firestore"""
        db = get_firestore()
        if not db:
            logger.warning("Firestore not available")
            return False
        
        try:
            doc_ref = db.collection('runs').document(run_id)
            doc_ref.set({
                'run_id': run_id,
                'briefing': briefing_data,
                'tasks': tasks,
                'status': 'created',
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            
            logger.info(f"Saved run {run_id} to Firestore")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save run: {e}")
            return False
    
    @staticmethod
    def save_task_result(task_id: str, result_data: Dict[str, Any]) -> bool:
        """Salva risultato di un task"""
        db = get_firestore()
        if not db:
            return False
        
        try:
            doc_ref = db.collection('task_results').document(task_id)
            doc_ref.set({
                'task_id': task_id,
                'result': result_data,
                'completed_at': firestore.SERVER_TIMESTAMP
            })
            
            # Aggiorna anche lo status del run
            run_id = task_id.rsplit('_task_', 1)[0]
            run_ref = db.collection('runs').document(run_id)
            run_ref.update({
                'updated_at': firestore.SERVER_TIMESTAMP,
                f'task_results.{task_id}': result_data.get('status', 'completed')
            })
            
            logger.info(f"Saved task result {task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save task result: {e}")
            return False

# API Endpoints
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "pubsub": get_publisher() is not None,
            "firestore": get_firestore() is not None,
            "secrets": config.get('X_API_KEY') is not None
        }
    }

@app.get("/stats")
async def stats(api_key: str = Depends(verify_api_key)):
    """Statistiche utilizzo"""
    now = datetime.now()
    month_key = now.strftime("%Y-%m")
    day_key = now.strftime("%Y-%m-%d")
    
    return {
        "usage": {
            "monthly": {
                "used": monthly_usage[month_key],
                "limit": config.get('MONTHLY_LIMIT', 10000)
            },
            "daily": {
                "used": daily_usage[day_key],
                "limit": config.get('DAILY_LIMIT', 500)
            }
        },
        "month": month_key,
        "day": day_key
    }

@app.post("/briefing")
async def briefing(
    request: Request,
    api_key: str = Depends(verify_api_key),
    x_bz_user: Optional[str] = Header(None)
):
    """
    Riceve un briefing e lo converte in task distribuiti
    """
    # Rate limiting
    RateLimiter.check_limits()
    
    try:
        data = await request.json()
        
        # Genera run_id unico
        run_id = TaskManager.create_run_id()
        
        # Parse briefing in task specifici
        tasks = TaskManager.parse_briefing(data)
        
        # Salva run in Firestore
        briefing_data = {
            **data,
            'user': x_bz_user or 'anonymous',
            'api_key_hash': hash(api_key)  # Non salvare la chiave vera
        }
        
        storage_saved = StorageManager.save_run(run_id, briefing_data, tasks)
        
        # Pubblica task su Pub/Sub
        tasks_published = TaskManager.publish_tasks(run_id, tasks)
        
        # Incrementa usage
        RateLimiter.increment_usage()
        
        logger.info(f"Created run {run_id} with {len(tasks)} tasks")
        
        return {
            "run_id": run_id,
            "status": "created",
            "tasks_count": len(tasks),
            "tasks_published": tasks_published,
            "storage_saved": storage_saved,
            "estimated_completion": (datetime.now() + timedelta(
                seconds=sum(task.get('estimated_time', 240) for task in tasks)
            )).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error processing briefing: {e}")
        raise HTTPException(500, f"Internal server error: {str(e)}")

@app.post("/tasks/{task_id}/result")
async def task_result(
    task_id: str,
    request: Request,
    token_payload: Optional[Dict] = Depends(verify_jwt_token)
):
    """
    Riceve risultato di un task da un agente
    """
    try:
        data = await request.json()
        
        # Validazione task_id format
        if '_task_' not in task_id:
            raise HTTPException(400, "Invalid task_id format")
        
        # Salva risultato
        result_saved = StorageManager.save_task_result(task_id, data)
        
        logger.info(f"Received result for task {task_id}")
        
        return {
            "task_id": task_id,
            "status": "stored" if result_saved else "storage_failed",
            "received_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error storing task result: {e}")
        raise HTTPException(500, f"Internal server error: {str(e)}")

@app.get("/runs/{run_id}")
async def get_run_status(
    run_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Recupera status di un run"""
    db = get_firestore()
    if not db:
        raise HTTPException(503, "Firestore not available")
    
    try:
        doc_ref = db.collection('runs').document(run_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(404, "Run not found")
        
        return doc.to_dict()
        
    except Exception as e:
        logger.error(f"Error retrieving run: {e}")
        raise HTTPException(500, str(e))

@app.get("/runs/{run_id}/results")
async def get_run_results(
    run_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Recupera tutti i risultati di un run"""
    db = get_firestore()
    if not db:
        raise HTTPException(503, "Firestore not available")
    
    try:
        # Query per tutti i task di questo run
        query = db.collection('task_results').where('task_id', '>=', f"{run_id}_task_")
        query = query.where('task_id', '<', f"{run_id}_task_z")
        
        results = {}
        for doc in query.stream():
            data = doc.to_dict()
            results[data['task_id']] = data['result']
        
        return {
            "run_id": run_id,
            "results": results,
            "tasks_completed": len(results)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving results: {e}")
        raise HTTPException(500, str(e))

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP {exc.status_code}: {exc.detail} - {request.url}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "timestamp": datetime.now().isoformat()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc} - {request.url}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "timestamp": datetime.now().isoformat()}
    )

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting Zantara Orchestrator on {host}:{port}")
    logger.info(f"Google Cloud Project: {config.get('GOOGLE_CLOUD_PROJECT')}")
    logger.info(f"Monthly limit: {config.get('MONTHLY_LIMIT', 10000)}")
    
    uvicorn.run(
        "orchestrator:app",
        host=host,
        port=port,
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )