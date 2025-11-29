# 🚂 Deployment auf Railway.app

## ⚠️ WICHTIG: Warum nicht Vercel?

Vercel unterstützt **keine WebSockets** für Echtzeit-Kommunikation. 
Für diese Buzzer-App brauchen wir aber WebSockets!

## ✅ Railway.app - Die perfekte Lösung

Railway unterstützt WebSockets vollständig und ist super einfach!

### Schritt-für-Schritt Anleitung:

#### 1. GitHub Repository erstellen (falls noch nicht geschehen)

1. Gehen Sie zu https://github.com/new
2. Repository-Name: `buzzer-app` (oder beliebig)
3. Klicken Sie "Create repository"

#### 2. Code hochladen

Öffnen Sie ein Terminal in Ihrem Projekt-Ordner:

```bash
git init
git add .
git commit -m "Initial commit - Buzzer App"
git branch -M main
git remote add origin https://github.com/IHR-USERNAME/buzzer-app.git
git push -u origin main
```

#### 3. Auf Railway deployen

1. **Railway.app öffnen**: https://railway.app
2. **Anmelden** mit GitHub
3. Klicken Sie **"New Project"**
4. Wählen Sie **"Deploy from GitHub repo"**
5. Wählen Sie Ihr **buzzer-app** Repository
6. Railway erkennt automatisch:
   - Node.js Projekt
   - Start-Befehl: `npm start`
   - Port: 3000
7. Klicken Sie **"Deploy"**

#### 4. Öffentliche URL aktivieren

1. In Railway: Klicken Sie auf Ihr Deployment
2. Gehen Sie zu **"Settings"**
3. Unter **"Networking"** → Klicken Sie **"Generate Domain"**
4. Ihre App ist jetzt öffentlich erreichbar! 🎉

## 🎮 Ihre App-URL

Nach dem Deployment bekommen Sie eine URL wie:
```
https://buzzer-app-production.up.railway.app
```

Diese URL können Sie mit allen Teilnehmern teilen!

## 💰 Kosten

Railway bietet:
- **$5 kostenlos** pro Monat
- Für eine Buzzer-App mit normalem Gebrauch reicht das locker!
- Danach: ca. $5-10/Monat bei regelmäßiger Nutzung

## 🔧 Troubleshooting

### "App startet nicht"
- Prüfen Sie die Logs in Railway
- Stellen Sie sicher, dass `package.json` korrekt ist

### "WebSocket verbindet nicht"
- Stellen Sie sicher, dass die generierte Domain verwendet wird
- Prüfen Sie, ob der Port korrekt ist (Railway setzt automatisch $PORT)

## 📊 Alternative: Render.com

Falls Sie Railway nicht nutzen möchten:

1. Gehen Sie zu https://render.com
2. Melden Sie sich mit GitHub an
3. "New" → "Web Service"
4. Wählen Sie Ihr Repository
5. Einstellungen:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Klicken Sie "Create Web Service"

Render ist ebenfalls kostenlos und unterstützt WebSockets!

## ✨ Fertig!

Nach dem Deployment können Sie:
- Die URL mit Freunden teilen
- Quiz-Spiele mit mehreren Geräten spielen
- Unbegrenzt viele Räume erstellen

Viel Spaß! 🎉
