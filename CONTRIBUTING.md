# Contributing Guide

## 📌 Commit Message Guidelines

Angelehnt an [Conventional Commits](https://www.conventionalcommits.org/) 

### Struktur der Commit-Nachricht:
<type>: <description>

### Zulässige Commit-Typen:
-  **feat**: Neues Feature
-  **fix**: Bugfix
-  **refactor**: Code-Verbesserung ohne funktionale Änderung
-  **test**: Änderungen an Tests
-  **docs**: Änderungen an der Dokumentation
-  **ci**: Änderungen an der CI/CD-Pipeline (Jenkins, etc..)
-  **build**: Änderungen am Build-System (z. B. Webpack, Vite, Maven (Pom), Gradle, ..)
-  **infra** Änderungen an der Infrastruktur (z. B. Kubernetes, Docker, ..)
-  **chore**: Pflege-Arbeiten ohne Feature/Fix-Charakter (z. B. Dependencies bumpen, `.gitignore`, Repo aufräumen)

### Aufbau der Descriprion
-  Verwende den **Imperativ** ("add", "fix", "update")  
-  Kurze, prägnante Nachricht. Die **erste Zeile unter 72 Zeichen**  
-  **Kein Punkt am Ende der Kurzbeschreibung**  


### Beispeile für eine korrekte Commit-Nachricht
✅ feat: add new UI component 

### Beispeile wann es ins Gesicht gibt
❌ a new UI component was added.

📌 **Tipp:** Das Projekt nutzt **commitlint**, das automatisch prüft, ob deine Commit-Message korrekt ist.