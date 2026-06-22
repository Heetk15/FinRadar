# CI/CD Implementation Guide

You've successfully generated the exact DevOps configurations required to shift the FinRadar project from manual execution into a modern, automated deployment pipeline. 

All files are placed directly in the main `FinRadar` root directory.

### Quick File Overview
1. **`docker-compose.devops.yml`**: A dedicated Compose configuration that launches Jenkins and SonarQube locally, networked so they can securely communicate.
2. **`Jenkinsfile`**: The declarative pipeline structure that acts as the "brain," dictating each step from code pulling to container launching.
3. **`deploy.yml`**: An Ansible instruction manual targeting `localhost` to systematically update running services safely.

---

> [!CAUTION]
> **Pre-Implementation Checklist**
> Ensure Docker is fully running, you have >4GB RAM free (SonarQube is a memory hog because of ElasticSearch), and your GitHub PAT token is ready before proceeding below.

---

### Implementation Questions & Answers

#### What are the two specific plugins I must install in Jenkins for this to work?
Because we are utilizing CLI implementations of tools over complex native bridges, you just need two primary extensions to bridge credentials and triggers:
1. **Ansible Plugin**: This allows Jenkins to execute your `deploy.yml` playbook smoothly without external wrap scripts.
2. **Credentials Binding Plugin**: (Usually default) This securely injects strings like your `github-token` and `sonar-token` safely into the pipeline's memory without hardcoding secrets in the script.

#### How do I generate a SonarQube Token and add it to Jenkins credentials?
1. **Generate Token**: Navigate to `http://localhost:9000` (Default credentials: `admin` / `admin`). Hit your profile icon at the top right -> **My Account** -> **Security** -> **Generate Token**. Name it `jenkins_analyzer` and copy it.
2. **Inject to Jenkins**: Go to your Jenkins Dashboard -> **Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials**. Click **Add Credentials**.
   - **Kind**: `Secret text`
   - **Secret**: *Paste the copied token*
   - **ID**: `sonar-token` (Must match the exact string in the `Jenkinsfile`!)

#### How do I give the Jenkins user permission to run Docker commands without `sudo` errors?
We solved this transparently in the `docker-compose.devops.yml` using two distinct properties:
1. **Host Mounting**: `- /var/run/docker.sock:/var/run/docker.sock` exposes the underlying Linux machine's Docker engine directly into the container.
2. **User Overlay**: `user: root` tells the container to start operations as the super-user, successfully granting read-write privileges to the raw socket, preventing permission-denied crashes. 

---

### How to Startup the DevOps Stack
You now essentially have two separate worlds. One is your **Application Stack**, and the other is your **DevOps Stack**. 

To boot up the DevOps Stack, simply run:
```bash
docker-compose -f docker-compose.devops.yml up -d
```
You can access Jenkins at `http://localhost:8080`, setup your pipeline job pointing at the repository, and watch it automate the entire build/deploy process!
