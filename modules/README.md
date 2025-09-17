# 📦 Moduli Infrastruttura Zantara

Questa directory contiene i moduli di infrastruttura e orchestrazione per il sistema Zantara Bridge.

## 🏗️ Struttura Moduli

### 1. **zantara-deploy** 
- **Scopo**: Pipeline CI/CD per deployment automatico
- **Tecnologie**: Cloud Build, Docker
- **File principale**: `cloudbuild.yaml`
- **Funzione**: Automatizza build e deploy su Google Cloud Run

### 2. **orchestrator**
- **Scopo**: Orchestrazione multi-agent con Flask/Python
- **Tecnologie**: Flask, Pub/Sub, Firestore
- **File principale**: `app.py`
- **Funzione**: Gestisce task breakdown e coordinamento agenti

### 3. **zantara-infrastructure**
- **Scopo**: Infrastructure as Code
- **Tecnologie**: Terraform, Google Cloud
- **File principale**: `cloud-run.tf`
- **Funzione**: Provisioning risorse cloud (Cloud Run, Pub/Sub, IAM)

### 4. **zantara-security**
- **Scopo**: Monitoring e sicurezza
- **Tecnologie**: Prometheus, Grafana, Docker Compose
- **File principale**: `docker-compose.monitoring.yml`
- **Funzione**: Stack di monitoring e alerting

### 5. **zantara-proxy**
- **Scopo**: Proxy autenticato per Cloud Run
- **Tecnologie**: Cloud Functions, Python
- **File principale**: `main.py`
- **Funzione**: Proxy con autenticazione IAM per servizi protetti

## 🚀 Utilizzo

### Deploy Completo
```bash
# 1. Setup infrastruttura
cd modules/zantara-infrastructure
terraform init
terraform apply

# 2. Deploy orchestrator
cd ../orchestrator
gcloud builds submit --config=../zantara-deploy/cloudbuild.yaml

# 3. Setup monitoring
cd ../zantara-security
docker-compose -f docker-compose.monitoring.yml up -d

# 4. Deploy proxy
cd ../zantara-proxy
gcloud functions deploy zantara_proxy --runtime python39
```

### Configurazione Ambiente
```bash
export PROJECT_ID="involuted-box-469105-r0"
export REGION="asia-southeast2"
export SERVICE_NAME="zantara-orchestrator"
```

## 🔗 Integrazione con Zantara Bridge

Questi moduli estendono le funzionalità del sistema principale:

- **Orchestrator**: Gestisce task complessi multi-step
- **Infrastructure**: Automatizza provisioning risorse
- **Security**: Fornisce observability e monitoring
- **Proxy**: Abilita accesso sicuro ai servizi
- **Deploy**: Automatizza CI/CD pipeline

## 📊 Architettura

```
Client Request → Proxy → Load Balancer → Orchestrator → Pub/Sub
                                              ↓
                                          Agent Pool
                                              ↓
                                          Firestore
```

## 🔐 Sicurezza

- API Key authentication su proxy
- IAM service accounts per ogni componente
- Secrets management via Secret Manager
- Monitoring con Prometheus/Grafana
- Network policies isolate

## 📈 Monitoring

Dashboard Grafana disponibile su: `http://localhost:3001`
- Username: `admin`
- Password: configurata in `GRAFANA_PASSWORD`

Metriche Prometheus: `http://localhost:9090`

## 🛠️ Manutenzione

### Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zantara-orchestrator"
```

### Health Check
```bash
curl https://zantara-orchestrator-xxxxx.a.run.app/health
```

### Scaling
```bash
gcloud run services update zantara-orchestrator --max-instances=20
```

## 📝 Note

- Tutti i moduli sono indipendenti e deployabili separatamente
- Configurazione centralizzata tramite environment variables
- Compatibile con pipeline CI/CD esistente
- Supporto multi-region ready

## 🤝 Contributi

Per contribuire ai moduli:
1. Crea branch feature
2. Test locale con Docker
3. Submit PR con test passing
4. Review e merge

---

*Moduli integrati da zantara_patch - Settembre 2024*