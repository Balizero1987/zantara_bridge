# 🔧 CI/CD INTEGRATION - ZANTARA BRIDGE

## 🔄 GITHUB ACTIONS

### Basic Workflow
```yaml
# .github/workflows/zantara-deploy.yml
name: Deploy with Zantara

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  ZANTARA_API_KEY: ${{ secrets.ZANTARA_API_KEY }}
  ZANTARA_URL: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Test Zantara Connection
        run: |
          curl -f -H "X-API-Key: $ZANTARA_API_KEY" \
            $ZANTARA_URL/health || exit 1
      
      - name: Upload Build to Drive
        run: |
          # Create build artifact
          tar -czf build.tar.gz dist/
          
          # Convert to base64
          BASE64_CONTENT=$(base64 -w 0 build.tar.gz)
          
          # Upload to Drive
          curl -X POST $ZANTARA_URL/drive/upload \
            -H "X-API-Key: $ZANTARA_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
              \"name\": \"build-$(date +%Y%m%d-%H%M%S).tar.gz\",
              \"content\": \"$BASE64_CONTENT\",
              \"folderId\": \"${{ secrets.DRIVE_FOLDER_ID }}\"
            }"
      
      - name: Create Calendar Event
        run: |
          curl -X POST $ZANTARA_URL/calendar/create \
            -H "X-API-Key: $ZANTARA_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{
              "summary": "Deployment: '"$GITHUB_SHA"'",
              "description": "Deployed by: '"$GITHUB_ACTOR"'",
              "start": "'"$(date -u +%Y-%m-%dT%H:%M:%S)Z"'",
              "end": "'"$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S)Z"'"
            }'
```

### Advanced Workflow with Matrix
```yaml
name: Multi-Environment Deploy

on:
  push:
    branches: [main, staging, develop]

jobs:
  deploy:
    strategy:
      matrix:
        environment: [dev, staging, prod]
        
    runs-on: ubuntu-latest
    environment: ${{ matrix.environment }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Zantara CLI
        run: |
          cat > zantara.sh << 'EOF'
          #!/bin/bash
          API_KEY="${{ secrets.ZANTARA_API_KEY }}"
          BASE_URL="https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"
          
          function zantara() {
            METHOD=$1
            ENDPOINT=$2
            DATA=$3
            
            curl -X $METHOD "$BASE_URL$ENDPOINT" \
              -H "X-API-Key: $API_KEY" \
              -H "Content-Type: application/json" \
              -d "$DATA"
          }
          EOF
          chmod +x zantara.sh
      
      - name: Deploy to ${{ matrix.environment }}
        run: |
          source ./zantara.sh
          
          # Upload config
          zantara POST /drive/upload '{
            "name": "config-${{ matrix.environment }}.json",
            "content": "'"$(base64 -w 0 config/${{ matrix.environment }}.json)"'",
            "folderId": "${{ secrets.DRIVE_FOLDER_ID }}"
          }'
```

---

## 🔵 GITLAB CI

```yaml
# .gitlab-ci.yml
variables:
  ZANTARA_URL: "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"

stages:
  - test
  - build
  - deploy
  - notify

test-zantara:
  stage: test
  script:
    - |
      curl -f -H "X-API-Key: $ZANTARA_API_KEY" \
        $ZANTARA_URL/health || exit 1

deploy:
  stage: deploy
  only:
    - main
  script:
    # Build artifact
    - tar -czf build.tar.gz dist/
    
    # Upload to Drive
    - |
      curl -X POST $ZANTARA_URL/drive/upload \
        -H "X-API-Key: $ZANTARA_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
          \"name\": \"gitlab-build-$CI_COMMIT_SHA.tar.gz\",
          \"content\": \"$(base64 -w 0 build.tar.gz)\",
          \"folderId\": \"$DRIVE_FOLDER_ID\"
        }"
    
    # Log deployment
    - |
      curl -X POST $ZANTARA_URL/actions/memory/save \
        -H "X-API-Key: $ZANTARA_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
          \"content\": \"Deployment completed: $CI_COMMIT_SHA by $GITLAB_USER_LOGIN\",
          \"tags\": [\"deployment\", \"gitlab\", \"$CI_ENVIRONMENT_NAME\"]
        }"

notify:
  stage: notify
  when: always
  script:
    - |
      STATUS="success"
      if [ "$CI_JOB_STATUS" != "success" ]; then
        STATUS="failed"
      fi
      
      curl -X POST $ZANTARA_URL/calendar/quickadd \
        -H "X-API-Key: $ZANTARA_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
          \"text\": \"Deploy $STATUS: $CI_PROJECT_NAME @ $(date)\"
        }"
```

---

## 🟢 JENKINS

### Jenkinsfile
```groovy
pipeline {
    agent any
    
    environment {
        ZANTARA_API_KEY = credentials('zantara-api-key')
        ZANTARA_URL = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app'
        DRIVE_FOLDER = credentials('drive-folder-id')
    }
    
    stages {
        stage('Test Connection') {
            steps {
                script {
                    sh '''
                        curl -f -H "X-API-Key: ${ZANTARA_API_KEY}" \
                          ${ZANTARA_URL}/health
                    '''
                }
            }
        }
        
        stage('Build') {
            steps {
                sh 'npm run build'
                sh 'tar -czf build.tar.gz dist/'
            }
        }
        
        stage('Upload to Drive') {
            steps {
                script {
                    def buildFile = readFile('build.tar.gz').bytes.encodeBase64().toString()
                    def timestamp = sh(returnStdout: true, script: 'date +%Y%m%d-%H%M%S').trim()
                    
                    sh """
                        curl -X POST ${ZANTARA_URL}/drive/upload \
                          -H "X-API-Key: ${ZANTARA_API_KEY}" \
                          -H "Content-Type: application/json" \
                          -d '{
                            "name": "jenkins-build-${timestamp}.tar.gz",
                            "content": "${buildFile}",
                            "folderId": "${DRIVE_FOLDER}"
                          }'
                    """
                }
            }
        }
        
        stage('Log Deployment') {
            steps {
                script {
                    sh """
                        curl -X POST ${ZANTARA_URL}/calendar/create \
                          -H "X-API-Key: ${ZANTARA_API_KEY}" \
                          -H "Content-Type: application/json" \
                          -d '{
                            "summary": "Jenkins Deploy: ${env.BUILD_NUMBER}",
                            "description": "Branch: ${env.BRANCH_NAME}\\nCommit: ${env.GIT_COMMIT}",
                            "start": "$(date -u +%Y-%m-%dT%H:%M:%S)Z",
                            "end": "$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S)Z"
                          }'
                    """
                }
            }
        }
    }
    
    post {
        success {
            script {
                sh """
                    curl -X POST ${ZANTARA_URL}/actions/memory/save \
                      -H "X-API-Key: ${ZANTARA_API_KEY}" \
                      -H "Content-Type: application/json" \
                      -d '{
                        "content": "✅ Build #${env.BUILD_NUMBER} succeeded",
                        "tags": ["jenkins", "success", "ci"]
                      }'
                """
            }
        }
        failure {
            script {
                sh """
                    curl -X POST ${ZANTARA_URL}/actions/email/send \
                      -H "X-API-Key: ${ZANTARA_API_KEY}" \
                      -H "Content-Type: application/json" \
                      -d '{
                        "to": "team@balizero.com",
                        "subject": "❌ Build Failed: #${env.BUILD_NUMBER}",
                        "body": "Build failed. Check Jenkins logs."
                      }'
                """
            }
        }
    }
}
```

---

## 🔷 AZURE DEVOPS

```yaml
# azure-pipelines.yml
trigger:
  - main

variables:
  ZANTARA_URL: 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app'

stages:
  - stage: Build
    jobs:
      - job: BuildAndDeploy
        pool:
          vmImage: 'ubuntu-latest'
        
        steps:
          - task: Bash@3
            displayName: 'Test Zantara Connection'
            inputs:
              targetType: 'inline'
              script: |
                curl -f -H "X-API-Key: $(ZANTARA_API_KEY)" \
                  $(ZANTARA_URL)/health
          
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
          
          - script: |
              npm ci
              npm run build
            displayName: 'Build project'
          
          - task: Bash@3
            displayName: 'Upload to Drive'
            inputs:
              targetType: 'inline'
              script: |
                tar -czf build.tar.gz dist/
                BASE64_CONTENT=$(base64 -w 0 build.tar.gz)
                
                curl -X POST $(ZANTARA_URL)/drive/upload \
                  -H "X-API-Key: $(ZANTARA_API_KEY)" \
                  -H "Content-Type: application/json" \
                  -d "{
                    \"name\": \"azure-build-$(Build.BuildNumber).tar.gz\",
                    \"content\": \"$BASE64_CONTENT\",
                    \"folderId\": \"$(DRIVE_FOLDER_ID)\"
                  }"
          
          - task: Bash@3
            displayName: 'Create Calendar Event'
            inputs:
              targetType: 'inline'
              script: |
                curl -X POST $(ZANTARA_URL)/calendar/create \
                  -H "X-API-Key: $(ZANTARA_API_KEY)" \
                  -H "Content-Type: application/json" \
                  -d '{
                    "summary": "Azure Deploy: $(Build.BuildNumber)",
                    "description": "Triggered by: $(Build.RequestedFor)",
                    "start": "'"$(date -u +%Y-%m-%dT%H:%M:%S)Z"'",
                    "end": "'"$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S)Z"'"
                  }'
```

---

## 🟠 CIRCLE CI

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  node: circleci/node@5

jobs:
  deploy-with-zantara:
    docker:
      - image: cimg/node:18.0
    
    steps:
      - checkout
      
      - run:
          name: Test Zantara Connection
          command: |
            curl -f -H "X-API-Key: $ZANTARA_API_KEY" \
              $ZANTARA_URL/health
      
      - node/install-packages
      
      - run:
          name: Build
          command: npm run build
      
      - run:
          name: Upload to Drive
          command: |
            tar -czf build.tar.gz dist/
            BASE64_CONTENT=$(base64 -w 0 build.tar.gz)
            
            curl -X POST $ZANTARA_URL/drive/upload \
              -H "X-API-Key: $ZANTARA_API_KEY" \
              -H "Content-Type: application/json" \
              -d "{
                \"name\": \"circle-build-${CIRCLE_BUILD_NUM}.tar.gz\",
                \"content\": \"$BASE64_CONTENT\",
                \"folderId\": \"$DRIVE_FOLDER_ID\"
              }"
      
      - run:
          name: Log to Calendar
          command: |
            curl -X POST $ZANTARA_URL/calendar/quickadd \
              -H "X-API-Key: $ZANTARA_API_KEY" \
              -H "Content-Type: application/json" \
              -d "{
                \"text\": \"CircleCI Deploy #${CIRCLE_BUILD_NUM} completed\"
              }"

workflows:
  deploy:
    jobs:
      - deploy-with-zantara:
          context: production-context
```

---

## 🐳 DOCKER CI/CD

### Dockerfile with Zantara
```dockerfile
FROM node:18-alpine AS builder

# Build stage
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Notify build complete
ARG ZANTARA_API_KEY
ARG ZANTARA_URL=https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app

RUN apk add --no-cache curl && \
    curl -X POST ${ZANTARA_URL}/actions/memory/save \
      -H "X-API-Key: ${ZANTARA_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"content": "Docker build completed", "tags": ["docker", "build"]}'

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/index.js"]
```

### Docker Compose with CI
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      args:
        ZANTARA_API_KEY: ${ZANTARA_API_KEY}
    environment:
      - ZANTARA_URL=https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
      - ZANTARA_API_KEY=${ZANTARA_API_KEY}
    
  ci-notifier:
    image: curlimages/curl:latest
    depends_on:
      - app
    command: |
      sh -c "
        curl -X POST ${ZANTARA_URL}/calendar/quickadd \
          -H 'X-API-Key: ${ZANTARA_API_KEY}' \
          -H 'Content-Type: application/json' \
          -d '{\"text\": \"Docker deployment completed\"}'
      "
```

---

## 🚀 GITHUB ACTIONS - COMPLETE EXAMPLE

```yaml
name: Full CI/CD with Zantara

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  ZANTARA_URL: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Tests
        run: npm test
      
      - name: Log Test Results
        if: always()
        run: |
          STATUS="✅ passed"
          if [ "${{ job.status }}" != "success" ]; then
            STATUS="❌ failed"
          fi
          
          curl -X POST $ZANTARA_URL/actions/memory/save \
            -H "X-API-Key: ${{ secrets.ZANTARA_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d "{
              \"content\": \"Tests $STATUS for PR #${{ github.event.pull_request.number || github.sha }}\",
              \"tags\": [\"ci\", \"test\", \"${{ github.event_name }}\"]
            }"

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Build & Deploy
        run: |
          # Your deploy script here
          echo "Deploying..."
      
      - name: Create Release Notes
        run: |
          # Get commit messages
          COMMITS=$(git log --pretty=format:"- %s" -n 10)
          
          # Save to Drive
          curl -X POST $ZANTARA_URL/drive/upload \
            -H "X-API-Key: ${{ secrets.ZANTARA_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d "{
              \"name\": \"release-notes-$(date +%Y%m%d).md\",
              \"content\": \"$(echo -e "# Release $(date +%Y-%m-%d)\n\n## Commits:\n$COMMITS" | base64 -w 0)\",
              \"folderId\": \"${{ secrets.DRIVE_FOLDER_ID }}\",
              \"mimeType\": \"text/markdown\"
            }"
      
      - name: Schedule Maintenance Window
        run: |
          curl -X POST $ZANTARA_URL/calendar/create \
            -H "X-API-Key: ${{ secrets.ZANTARA_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "summary": "Deployment: ${{ github.sha }}",
              "description": "Automated deployment from GitHub Actions\nActor: ${{ github.actor }}\nBranch: ${{ github.ref }}",
              "start": "'"$(date -u +%Y-%m-%dT%H:%M:%S)Z"'",
              "end": "'"$(date -u -d '+30 minutes' +%Y-%m-%dT%H:%M:%S)Z"'",
              "colorId": "2"
            }'
      
      - name: Send Success Email
        if: success()
        run: |
          curl -X POST $ZANTARA_URL/actions/email/send \
            -H "X-API-Key: ${{ secrets.ZANTARA_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "to": "team@balizero.com",
              "subject": "✅ Deployment Successful: ${{ github.sha }}",
              "body": "Deployment completed successfully.\n\nCommit: ${{ github.event.head_commit.message }}\nAuthor: ${{ github.event.head_commit.author.name }}\nTime: '"$(date)"'"
            }'
```

---

## 🔑 SECRETS CONFIGURATION

### GitHub Actions
```bash
# Add secrets in repo settings
Settings → Secrets → Actions → New repository secret
- ZANTARA_API_KEY
- DRIVE_FOLDER_ID
```

### GitLab CI
```bash
# Add in CI/CD settings
Settings → CI/CD → Variables → Add variable
- ZANTARA_API_KEY (Protected, Masked)
- DRIVE_FOLDER_ID
```

### Jenkins
```groovy
// Add in Jenkins credentials
Jenkins → Credentials → System → Global credentials → Add Credentials
- Kind: Secret text
- ID: zantara-api-key
- Secret: [your-api-key]
```

---

## 📊 MONITORING CI/CD

### Dashboard Query
```bash
# Get all CI/CD events from last 24h
curl -X POST $ZANTARA_URL/actions/memory/search \
  -H "X-API-Key: $ZANTARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["ci", "deployment"],
    "since": "'"$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)Z"'"
  }'
```

---

**Last Updated**: 2024-01-19
**Version**: 1.0.0