# Sadias Soundboard

Ein Tippen-und-Abspielen-Soundboard mit Fotos und Stimmen der Familie und Lieblingskuscheltiere. Läuft komplett statisch auf GitHub Pages — keine eigene Server-Infrastruktur, kein Backend, kein Lucid-Bezug.

## Live-Seite

https://franzschurmann.github.io/sadia-soundboard/

(Erst erreichbar, nachdem GitHub Pages einmalig aktiviert wurde — siehe unten.)

## Einmalig einrichten: GitHub Pages aktivieren

1. Im Repo auf GitHub: **Settings → Pages**
2. "Build and deployment" → Source: **Deploy from a branch**
3. Branch: **main**, Ordner: **/(root)**
4. Save

Dauert danach 1–2 Minuten, bis die Seite zum ersten Mal online ist.

## Passwort

Beim ersten Öffnen (pro Gerät/Browser) fragt die Seite nach einem Passwort: **Sadia**

**Wichtig, ehrlich gesagt:** Das ist nur ein Vorhang gegen zufällige Besucher, keine echte Absicherung. Das Repo ist öffentlich — wer die genaue Bild-/Audio-URL kennt oder das Repo durchsucht, kann Fotos und Aufnahmen trotzdem sehen, Passwort hin oder her. Eine echte Zugriffskontrolle würde einen Server brauchen, was hier bewusst nicht der Fall ist (maximal einfach, 0 zusätzliche Infrastruktur).

## Admin-Modus (Kacheln hinzufügen / umbenennen / löschen)

Zahnrad-Symbol oben rechts antippen.

Einmalig pro Gerät (dein Handy, die Handys der Eltern, etc.) ein GitHub-Token einrichten:

1. https://github.com/settings/personal-access-tokens/new öffnen
2. Name: z.B. "sadia-soundboard-admin"
3. Resource owner: franzschurmann
4. Repository access → **Only select repositories** → sadia-soundboard
5. Permissions → Repository permissions → **Contents** → **Read and write** (sonst nichts)
6. Generate token, Token kopieren
7. Im Zahnrad-Bereich der Seite einfügen und speichern

Das Token wird nur lokal im Browser gespeichert (localStorage) und landet nie im Code oder Repo. Jedes Gerät braucht sein eigenes Token, oder man verwendet auf mehreren Geräten denselben — dann muss man beim Widerrufen aber auch überall neu einrichten.

**Kachel hinzufügen:** Name + Foto + entweder eine Audiodatei hochladen oder direkt über das Mikrofon aufnehmen ("🎙️ Aufnahme starten" / "⏹️ Aufnahme stoppen").

Nach dem Speichern committet GitHub die Dateien direkt ins Repo. GitHub Pages braucht danach bis zu ~1 Minute, um die neue Version live zu stellen — kurz warten und neu laden.

## Wer sieht/darf was

- Wer das Seiten-Passwort kennt, sieht das Board und kann Sounds abspielen.
- Nur wer zusätzlich ein GitHub-Token eingerichtet hat, kann Kacheln hinzufügen, umbenennen oder löschen.

## Sicherheitshinweis zum Token

Das Token erlaubt Schreibzugriff auf genau dieses eine Repo, beschränkt auf "Contents". Nicht auf einem fremden oder öffentlichen Gerät einfügen. Bei Verdacht auf Missbrauch: unter https://github.com/settings/tokens?type=beta das Token löschen — das Board funktioniert dann ohne dieses Gerät weiter, einfach ein neues Token erzeugen und auf den verbleibenden Geräten eintragen.

## Lokal testen

Da die Seite `data/tiles.json` per `fetch()` lädt, funktioniert das direkte Doppelklick-Öffnen von `index.html` in manchen Browsern nicht (CORS bei `file://`). Stattdessen im Projektordner:

```
python3 -m http.server 8000
```

und dann `http://localhost:8000` öffnen.

## Struktur

- `index.html`, `css/style.css`, `js/app.js` — die App
- `data/tiles.json` — Liste aller Kacheln (Name + Pfade zu Foto/Audio)
- `media/` — die eigentlichen Fotos und Audiodateien, vom Admin-Panel aus befüllt

## Warum kein eigener Server

Bewusst 0 zusätzliche Infrastruktur: Hosting ist GitHub Pages (kostenlos), die "Datenbank" ist `data/tiles.json` im selben Repo, und der Schreibzugriff fürs Admin-Panel läuft direkt über die GitHub-API mit einem eng begrenzten Token. Kein separates Backend, kein Account bei einem Drittanbieter nötig.
