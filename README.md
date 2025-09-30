# Kfz-Schadenaufnahme App

Eine moderne, statische Web-Anwendung zur digitalen Erfassung von Kfz-Schäden, entwickelt mit HTML, CSS und JavaScript, und einem robusten Backend auf Basis von Supabase (PostgreSQL, Authentifizierung, Speicherung).

## 🚀 Ziel & MVP (Minimum Viable Product)

Das Hauptziel dieser Anwendung ist es, Versicherungsnehmern eine einfache und intuitive Möglichkeit zu bieten, Kfz-Schäden digital zu melden. Das MVP konzentriert sich auf die folgenden Kernfunktionen:

1.  **Login:** Passwortloser Zugang über Magic-Link (E-Mail).
2.  **Schadenaufnahme-Wizard:** Ein geführter Prozess in 5 Schritten zur Erfassung aller relevanten Schadendetails mit Validierung.
3.  **Foto-/Dokumenten-Upload:** Hochladen von Bildern (z.B. Fahrzeugschein, Schadensfotos) in Supabase Storage.
4.  **Entwurf speichern & Einreichen:** Möglichkeit, den Schaden als Entwurf zu speichern und später einzureichen (Statuswechsel).
5.  **Fallübersicht:** Eine Liste aller gemeldeten Schäden mit Detailansicht.
6.  **RLS-sichere Datenbank:** Jeder Nutzer sieht nur seine eigenen Fälle.

## 🛠️ Technologien

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (SPA-ähnlich)
*   **Backend:** [Supabase](https://supabase.com/) (Auth, PostgreSQL Database mit RLS, Storage)
*   **Hosting:** [Vercel](https://vercel.com/) (für statische Apps und Preview Deployments)
*   **Entwicklung:** GitHub

## 🏗️ Architektur (Einfach & Günstig)

Die Anwendung ist als statische HTML-App konzipiert, die über Vercel gehostet wird. Das Backend wird vollständig von Supabase bereitgestellt, was die Notwendigkeit eines eigenen Servers eliminiert und die Betriebskosten minimiert.

*   **Frontend:** Statisches HTML, CSS und JavaScript für eine schnelle und reaktionsschnelle Benutzeroberfläche.
*   **Supabase:**
    *   **Auth:** E-Mail-basierter Magic-Link-Login.
    *   **Postgres:** Robuste relationale Datenbank mit Row Level Security (RLS).
    *   **Storage:** Sichere Speicherung von Fotos und Dokumenten.
*   **Vercel:** Nahtlose Integration mit GitHub für automatische Deployments und Preview-Umgebungen.

## ⚙️ Setup und Installation

Befolgen Sie diese Schritte, um das Projekt lokal einzurichten und auf Supabase/Vercel bereitzustellen.

### 1. Supabase Projekt einrichten

1.  **Neues Projekt erstellen:** Gehen Sie zu [Supabase](https://app.supabase.com/) und erstellen Sie ein neues Projekt.
2.  **API-Schlüssel:** Navigieren Sie zu `Project Settings > API` und notieren Sie sich Ihre `Project URL` und den `anon public` Schlüssel.
3.  **Datenbank-Schema:** Führen Sie das SQL-Skript aus `sql/supabase_schema.sql` in Ihrem Supabase SQL Editor aus. Dieses Skript erstellt alle notwendigen Tabellen, Trigger und RLS-Richtlinien.
    *   Stellen Sie sicher, dass Sie `Row Level Security` für alle `public` Tabellen in Ihrem Supabase Dashboard aktivieren (`Authentication > Policies`).
4.  **Storage Bucket:** Erstellen Sie einen neuen Storage Bucket namens `claim-files` unter `Storage` in Ihrem Supabase Dashboard. Aktivieren Sie RLS für diesen Bucket und wenden Sie die im SQL-Skript definierten Policies an.

### 2. Lokale Entwicklung

1.  **Repository klonen:**
    ```bash
    git clone https://github.com/your-username/kfz-schadenaufnahme-app.git
    cd kfz-schadenaufnahme-app
    ```
2.  **Umgebungsvariablen:** Kopieren Sie die `.env.sample` Datei zu `.env` und füllen Sie Ihre Supabase-Anmeldeinformationen aus:
    ```bash
    cp .env.sample .env
    ```
    Bearbeiten Sie die `.env` Datei:
    ```
    SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
    SUPABASE_ANON_KEY=[YOUR_ANON_PUBLIC_KEY]
    ```
    *Hinweis: Die `.env` Datei ist in `.gitignore` enthalten und sollte niemals in Ihr Repository committet werden.*
3.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```
    *(Obwohl es sich um eine Vanilla JS App handelt, wird `npm` für die Installation des Supabase JS SDK verwendet.)*
4.  **Anwendung starten:**
    ```bash
    npm run dev
    ```
    Öffnen Sie `http://localhost:3000` in Ihrem Browser.

### 3. Deployment auf Vercel

1.  **GitHub Repository:** Pushen Sie Ihren Code in ein GitHub-Repository.
2.  **Vercel Integration:** Gehen Sie zu [Vercel](https://vercel.com/) und importieren Sie Ihr GitHub-Repository.
3.  **Umgebungsvariablen:** Fügen Sie in den Vercel-Projekteinstellungen (`Settings > Environment Variables`) die folgenden Variablen hinzu:
    *   `SUPABASE_URL`
    *   `SUPABASE_ANON_KEY`
    
    Diese werden von der Anwendung zur Verbindung mit Supabase verwendet.
4.  **Deploy:** Vercel wird Ihre Anwendung automatisch bereitstellen. Jeder Push auf den `main`-Branch löst ein neues Deployment aus, und Pull Requests erhalten Preview-Deployments.

## 📊 Datenmodell (Übersicht)

Das Datenmodell ist darauf ausgelegt, alle relevanten Informationen für die Schadenaufnahme zu speichern. Die wichtigsten Entitäten sind:

*   `profiles`: Benutzerprofile, verknüpft mit Supabase Auth.
*   `claims`: Haupttabelle für Schadenfälle.
*   `vehicles`: Informationen zu den beteiligten Fahrzeugen.
*   `claim_parties`: Details zu beteiligten Dritten (Gegner, Zeugen, Polizei).
*   `damages`: Spezifische Schäden am Fahrzeug.
*   `documents`: Verweise auf hochgeladene Dateien in Supabase Storage.
*   `claim_status_history`: Historie der Statusänderungen eines Schadenfalls.
*   `notes`: Interne Notizen zu einem Schadenfall.

Eine detaillierte Definition finden Sie in der Datei `sql/supabase_schema.sql`.

## 🔒 Row Level Security (RLS)

Alle sensiblen Tabellen sind mit RLS geschützt, um sicherzustellen, dass Benutzer nur auf Daten zugreifen können, die ihnen gehören oder für die sie berechtigt sind. Die RLS-Richtlinien sind so konfiguriert, dass:

*   Profile nur vom jeweiligen Nutzer selbst eingesehen werden können.
*   Schadenfälle nur vom `owner_id` oder einem `admin` eingesehen, erstellt und aktualisiert werden können.
*   Zugehörige Tabellen (`vehicles`, `claim_parties`, `damages`, `documents`, `claim_status_history`, `notes`) nur über den Besitz des zugehörigen Schadenfalls zugänglich sind.
*   Storage-Objekte im `claim-files` Bucket nur hochgeladen und gelesen werden können, wenn der Nutzer der Eigentümer des zugehörigen Schadenfalls ist.

Die genauen RLS-Definitionen sind in `sql/supabase_schema.sql` enthalten.

## 📝 Nutzung

1.  **Anmelden:** Geben Sie Ihre E-Mail-Adresse ein und klicken Sie auf "Magic-Link senden". Überprüfen Sie Ihr Postfach und klicken Sie auf den Link, um sich anzumelden.
2.  **Dashboard:** Nach dem Login sehen Sie eine Übersicht Ihrer Schadenfälle. Klicken Sie auf "Neuen Schaden melden", um einen neuen Fall zu starten.
3.  **Schadenaufnahme-Wizard:** Folgen Sie den 5 Schritten, um alle notwendigen Informationen einzugeben:
    *   **Schaden:** Datum, Art, Ort, Beschreibung.
    *   **Fahrzeug:** Kennzeichen, Hersteller, Modell, FIN, Kilometerstand, Fahrbereitschaft.
    *   **Beteiligte:** Hinzufügen von Unfallgegnern, Zeugen oder Polizeikontakten.
    *   **Fotos:** Hochladen von Bildern und Dokumenten per Drag & Drop oder Dateiauswahl.
    *   **Zusammenfassung:** Überprüfen Sie alle Angaben und reichen Sie den Schadenfall ein.
4.  **Entwürfe:** Sie können jederzeit einen Schaden als Entwurf speichern und später fortsetzen.

## 🗺️ Roadmap (Geplante Erweiterungen)

**Sprint 1 (MVP) - Abgeschlossen mit diesem Starter-Projekt:**
*   Auth, DB+RLS, Wizard Schritt 1–3, Insert/Listenansicht, Dokument-Upload, Entwürfe, Status `submitted`.

**Sprint 2 (Nächste Schritte):**
*   **Karosserie-Overlay:** Interaktives SVG-Modell zur Markierung von Schadstellen.
*   **Status-Timeline:** Visuelle Darstellung des Schadenverlaufs.
*   **E-Mail Bestätigung:** Automatische E-Mail an den Nutzer nach Einreichung.
*   **PDF-Export:** Generierung einer PDF-Zusammenfassung des Schadenfalls.
*   **Admin-Liste:** Separate Ansicht für Administratoren zur Verwaltung aller Fälle.
*   **Einfache Suche/Filter:** Filter- und Suchfunktionen für die Fallübersicht.

## 🤝 Mitwirken

Beiträge sind herzlich willkommen! Bitte öffnen Sie ein Issue, um Fehler zu melden oder Funktionen vorzuschlagen, oder reichen Sie einen Pull Request ein.

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert. Siehe die [LICENSE](LICENSE) Datei für Details. (Noch zu erstellen)

