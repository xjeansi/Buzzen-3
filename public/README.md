# 🔔 Buzzer App - Multi-Device Quiz Buzzer

Eine Echtzeit-Buzzer-App für Quiz und Spiele, die über mehrere Geräte synchronisiert wird.

## ✨ Features

- ✅ **Multi-Device Support**: Mehrere Spieler können gleichzeitig mit ihren eigenen Geräten teilnehmen
- ✅ **Echtzeit-Synchronisation**: WebSocket-basierte Kommunikation für sofortige Updates
- ✅ **Raum-System**: Verschiedene Quiz-Runden in separaten Räumen
- ✅ **Einfache Bedienung**: Intuitive Benutzeroberfläche
- ✅ **Responsive Design**: Funktioniert auf Desktop, Tablet und Smartphone

## 🚀 Deployment auf Vercel

### Voraussetzungen

- Ein GitHub-Account
- Ein Vercel-Account (kostenlos unter https://vercel.com)

### Schritt-für-Schritt Anleitung

#### 1. Repository auf GitHub erstellen

1. Gehen Sie zu https://github.com und melden Sie sich an
2. Klicken Sie auf "New Repository"
3. Geben Sie einen Namen ein (z.B. "buzzer-app")
4. Klicken Sie auf "Create repository"

#### 2. Code hochladen

Öffnen Sie ein Terminal und führen Sie folgende Befehle aus:

```bash
cd /pfad/zu/buzzer-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/IHR-USERNAME/buzzer-app.git
git push -u origin main
```

#### 3. Auf Vercel deployen

1. Gehen Sie zu https://vercel.com und melden Sie sich an
2. Klicken Sie auf "Add New..." → "Project"
3. Importieren Sie Ihr GitHub Repository (buzzer-app)
4. Vercel erkennt automatisch die Einstellungen
5. Klicken Sie auf "Deploy"

#### 4. Fertig! 🎉

Nach wenigen Minuten ist Ihre App live unter einer URL wie:
`https://buzzer-app-ihrusername.vercel.app`

## 📱 Verwendung

### Als Quiz-Master

1. Öffnen Sie die App-URL
2. Geben Sie einen **Raum-Code** ein (z.B. "QUIZ123")
3. Geben Sie Ihren Namen ein
4. Klicken Sie auf "Beitreten"
5. Teilen Sie den Raum-Code mit den Teilnehmern

### Als Teilnehmer

1. Öffnen Sie die gleiche App-URL auf Ihrem Gerät
2. Geben Sie den **gleichen Raum-Code** ein wie der Quiz-Master
3. Geben Sie Ihren Namen ein
4. Klicken Sie auf "Beitreten"
5. Drücken Sie "BUZZ!" wenn Sie die Antwort wissen

### Während des Quiz

- **Buzzern**: Drücken Sie den großen BUZZ-Button
- **Wer war zuerst?**: Die App zeigt automatisch an, wer zuerst gebuzzert hat
- **Zurücksetzen**: Der Quiz-Master kann für die nächste Frage zurücksetzen
- **Spielerliste**: Sehen Sie alle Teilnehmer und ihren Status

## 🛠️ Lokale Entwicklung

Falls Sie die App lokal testen möchten:

```bash
# Abhängigkeiten installieren
npm install

# Server starten
npm start
```

Die App läuft dann auf `http://localhost:3000`

## 📋 Technische Details

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js mit Express
- **WebSocket**: ws Library für Echtzeit-Kommunikation
- **Hosting**: Vercel

## ⚠️ Wichtiger Hinweis zu Vercel

Vercel hat derzeit **eingeschränkten WebSocket-Support**. Für eine produktionsreife Lösung mit vielen gleichzeitigen Nutzern empfehlen wir:

### Alternative Hosting-Optionen:

1. **Railway.app** (empfohlen für WebSockets)
   - Kostenloser Plan verfügbar
   - Volle WebSocket-Unterstützung
   - Einfaches Deployment

2. **Render.com**
   - Kostenloser Plan verfügbar
   - Gute WebSocket-Unterstützung

3. **Heroku**
   - WebSocket-kompatibel
   - Kostenloser Plan (mit Einschränkungen)

### Deployment auf Railway (Alternative)

1. Gehen Sie zu https://railway.app
2. Melden Sie sich mit GitHub an
3. Klicken Sie auf "New Project" → "Deploy from GitHub repo"
4. Wählen Sie Ihr Repository
5. Railway deployt automatisch
6. Ihre App ist live!

## 🔧 Anpassungen

### Raum-Code Format ändern

In `public/index.html`, Zeile mit `maxlength="20"` anpassen

### Styling anpassen

Alle Styles befinden sich in `public/index.html` im `<style>` Tag

### Server-Port ändern

In `server.js` die Variable `PORT` anpassen

## 📞 Support

Bei Fragen oder Problemen können Sie:
- Ein GitHub Issue erstellen
- Die Dokumentation durchlesen
- Nach "WebSocket Buzzer App" googeln

## 📄 Lizenz

MIT License - Sie können dieses Projekt frei verwenden und anpassen.

---

Viel Spaß mit Ihrer Buzzer-App! 🎉
