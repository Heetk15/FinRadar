pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    parameters {
        choice(name: 'DEPLOY_MODE', choices: ['k8s', 'ssh'], description: 'Deployment mode: Kubernetes cluster deploy or SSH target deployment')
        string(name: 'LOCAL_COMPOSE_PROJECT', defaultValue: 'FinRadar', description: 'Compose project name used in local mode to avoid duplicate stacks from different workspace paths')
        string(name: 'DEPLOY_HOST', defaultValue: 'host.docker.internal', description: 'SSH reachable host where Docker Compose will run')
        string(name: 'DEPLOY_USER', defaultValue: 'deploy', description: 'SSH user on deployment host')
        string(name: 'DEPLOY_PATH', defaultValue: '/opt/FinRadar', description: 'Absolute path on target host containing docker-compose.yml')
    }

    environment {
        // SonarQube connects via the shared devops network — use SERVICE name not container_name
        SONAR_HOST_URL = 'http://sonarqube:9000'
        // Bind the SonarQube token safely from Jenkins Credentials
        SONAR_TOKEN = credentials('sonar-token')
        // Explicitly pinned network name from docker-compose.devops.yml
        DEVOPS_NETWORK = 'FinRadar_devops_net'
        // Deployment values are runtime parameters to support local and remote targets.
        DEPLOY_HOST = "${params.DEPLOY_HOST}"
        DEPLOY_USER = "${params.DEPLOY_USER}"
        DEPLOY_PATH = "${params.DEPLOY_PATH}"
        LOCAL_COMPOSE_PROJECT = "${params.LOCAL_COMPOSE_PROJECT}"
    }

    stages {
        stage('Checkout Source') {
            steps {
                echo "Pulling latest code from main branch..."
                checkout scmGit(branches: [[name: '*/main']], extensions: [], userRemoteConfigs: [[url: 'https://github.com/Heetk15/FinRadar.git', credentialsId: 'github-token']])
            }
        }

        stage('Unit Tests (Pytest)') {
            steps {
                echo "Running Pytest unit tests in a temporary container..."
                sh '''
                docker run --rm \
                    --network "${DEVOPS_NETWORK}" \
                    --volumes-from jenkins-devops \
                    -w "${WORKSPACE}/backend" \
                    python:3.10-slim \
                    sh -c "pip install --no-cache-dir -r requirements.txt pytest-cov && pytest test_main.py -v --cov=main --cov-report=xml:coverage.xml"
                '''
            }
        }

        stage('Pre-flight Summary') {
            steps {
                echo "Deployment pre-flight check"
                sh '''
                echo "============================================="
                echo "FinRadar Pipeline Pre-flight Summary"
                echo "Build Number : ${BUILD_NUMBER}"
                echo "Branch       : ${BRANCH_NAME:-main}"
                echo "Deploy Mode  : ${DEPLOY_MODE}"
                echo "Local Project: ${LOCAL_COMPOSE_PROJECT}"
                echo "Deploy Host  : ${DEPLOY_HOST}"
                echo "Deploy User  : ${DEPLOY_USER}"
                echo "Deploy Path  : ${DEPLOY_PATH}"
                echo "Workspace    : ${WORKSPACE}"
                echo "============================================="
                '''
            }
        }

                stage('Validate Deploy Mode') {
                        steps {
                                sh '''
                                case "${DEPLOY_MODE}" in
                                    k8s|ssh)
                                        echo "DEPLOY_MODE ${DEPLOY_MODE} is valid"
                                        ;;
                                    local)
                                        echo "DEPLOY_MODE=local detected (legacy). Treating as k8s for backward compatibility."
                                        ;;
                                    *)
                                        echo "Invalid DEPLOY_MODE: ${DEPLOY_MODE}. Allowed values: k8s, ssh"
                                        exit 1
                                        ;;
                                esac
                                '''
                        }
                }

        stage('Code Quality (SonarQube)') {
            steps {
                echo "Running SonarScanner via CLI container..."
                // Use jenkins container volumes so scanner sees the real workspace even with Docker socket mounting.
                sh '''
                docker run --rm \
                    -e SONAR_HOST_URL="${SONAR_HOST_URL}" \
                    --volumes-from jenkins-devops \
                    --network "${DEVOPS_NETWORK}" \
                    -w "${WORKSPACE}" \
                    sonarsource/sonar-scanner-cli:4.8 \
                    -Dsonar.projectKey=FinRadar \
                    -Dsonar.projectBaseDir="${WORKSPACE}" \
                    -Dsonar.sources=frontend/src,backend \
                    -Dsonar.python.version=3.10 \
                    -Dsonar.python.coverage.reportPaths=backend/coverage.xml \
                    -Dsonar.coverage.exclusions=frontend/src/**,backend/test_*.py \
                    -Dsonar.scm.provider=git \
                    -Dsonar.login="${SONAR_TOKEN}" \
                    -Dsonar.exclusions=**/node_modules/**,**/__pycache__/**,**/.next/**,**/.git/**
                '''
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                                        sh '''
                                        set -e

                                        REPORT_FILE="${WORKSPACE}/.scannerwork/report-task.txt"
                                        test -f "${REPORT_FILE}"

                                        CE_TASK_ID=$(grep '^ceTaskId=' "${REPORT_FILE}" | cut -d'=' -f2-)
                                        SONAR_SERVER=$(grep '^serverUrl=' "${REPORT_FILE}" | cut -d'=' -f2-)

                                        if [ -z "${SONAR_SERVER}" ]; then
                                            SONAR_SERVER="${SONAR_HOST_URL}"
                                        fi

                                        if [ -z "${CE_TASK_ID}" ] || [ -z "${SONAR_SERVER}" ]; then
                                            echo "Missing ceTaskId or serverUrl in report-task.txt"
                                            exit 1
                                        fi

                                        ANALYSIS_ID=""
                                        for _ in $(seq 1 60); do
                                            CE_JSON=$(curl -sS -u "${SONAR_TOKEN}:" "${SONAR_SERVER}/api/ce/task?id=${CE_TASK_ID}")

                                            CE_STATUS=$(printf '%s' "${CE_JSON}" | python3 -c "import json,sys; print(json.load(sys.stdin)['task']['status'])")

                                            if [ "${CE_STATUS}" = "PENDING" ] || [ "${CE_STATUS}" = "IN_PROGRESS" ]; then
                                                sleep 5
                                                continue
                                            fi

                                            if [ "${CE_STATUS}" != "SUCCESS" ]; then
                                                echo "Sonar Compute Engine task failed with status: ${CE_STATUS}"
                                                exit 1
                                            fi

                                            ANALYSIS_ID=$(printf '%s' "${CE_JSON}" | python3 -c "import json,sys; print(json.load(sys.stdin)['task'].get('analysisId',''))")
                                            break
                                        done

                                        if [ -z "${ANALYSIS_ID}" ]; then
                                            echo "Timed out waiting for Sonar Compute Engine analysisId"
                                            exit 1
                                        fi

                                        QG_JSON=$(curl -sS -u "${SONAR_TOKEN}:" "${SONAR_SERVER}/api/qualitygates/project_status?analysisId=${ANALYSIS_ID}")
                                        QG_STATUS=$(printf '%s' "${QG_JSON}" | python3 -c "import json,sys; print(json.load(sys.stdin)['projectStatus']['status'])")

                                        echo "Quality Gate status: ${QG_STATUS}"
                                        if [ "${QG_STATUS}" != "OK" ]; then
                                            exit 1
                                        fi
                                        '''
                }
            }
        }

        stage('Validate Toolchain') {
            steps {
                sh '''
                docker --version
                docker compose version
                kubectl version --client
                ansible --version
                '''
            }
        }

        stage('Docker Build') {
            steps {
                echo "Building application images..."
                sh 'docker compose -p "${LOCAL_COMPOSE_PROJECT}" -f docker-compose.yml build'
            }
        }
    }
}
