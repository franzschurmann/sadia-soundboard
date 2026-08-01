# Sadias Soundboard

Ein Tippen-und-Abspielen-Soundboard mit Fotos und Stimmen der Familie und Lieblingskuscheltiere. Läuft komplett statisch auf GitHub Pages — keine eigene Server-Infrastruktur, kein Backend, kein Lucid-Bezug.

## Live-Seite

https://franzschurmann.github.io/sadia-soundboard/

## Passwort

Die Seite fragt beim Öffnen nach einem Passwort: **Sadia**

Die Eingabe wird im `localStorage` des Browsers gemerkt — also dauerhaft pro Gerät und Browser, nicht nur für eine Sitzung. Wer die Abfrage wiedersehen will, löscht die Seitendaten im Browser.

**Ehrlich gesagt:** Das ist nur ein Vorhang gegen zufällige Besucher, keine echte Absicherung. Das Repo ist öffentlich — wer die genaue Bild-/Audio-URL kennt oder das Repo durchsucht, kann Fotos und Aufnahmen trotzdem sehen. Bewusst in Kauf genommen, weil es ein Spaßprojekt für die Familie ist, kein Hochsicherheits-Repo.

## Admin-Modus (Kacheln hinzufügen / umbenennen / löschen)

Zahnrad-Symbol oben rechts antippen. Sobald einmal das Passwort "Sadia" eingegeben wurde, ist der Admin-Bereich direkt nutzbar — **kein Token pro Gerät nötig.**

**Einmalig insgesamt** (nicht pro Gerät) muss trotzdem ein GitHub-Token hinterlegt werden, damit das Panel technisch Dateien ins Repo schreiben kann. Das übernimmt am besten Franz:

1. https://github.com/settings/personal-access-tokens/new öffnen
2. Name: z.B. "sadia-soundboard-admin"
3. Resource owner: franzschurmann
4. Repository access → **Only select repositories** → sadia-soundboard
5. Permissions → Repository permissions → **Contents** → **Read and write** (sonst nichts)
6. Generate token, Token kopieren
7. Auf der Seite: Zahnrad antippen → Token einmalig einfügen → "Einrichten"

Das Token wird dabei mit dem Passwort "Sadia" verschlüsselt und so im Repo abgelegt (`data/admin.key`), nicht im Klartext. Ab da reicht für jeden, der die Seite mit "Sadia" öffnet, automatisch auch der Admin-Bereich — auf jedem Gerät, ohne noch mal ein Token einzugeben.

**Kachel hinzufügen:** Name + Foto + entweder eine Audiodatei hochladen oder direkt über das Mikrofon aufnehmen ("🎙️ Aufnahme starten" / "⏹️ Aufnahme stoppen").

Fotos werden vor dem Hochladen im Browser auf 900×900 (quadratischer Mittenausschnitt, JPEG) verkleinert. Ein 4-MB-Handyfoto landet so als ~100 KB im Repo — wichtig, weil jede hochgeladene Datei dauerhaft in der Git-History bleibt und die Kacheln ohnehin nur wenige hundert Pixel groß dargestellt werden.

Nach dem Speichern committet GitHub die Dateien direkt ins Repo. GitHub Pages braucht danach bis zu ~1 Minute, um die neue Version live zu stellen — kurz warten und neu laden.

## Wer sieht/darf was

Nur noch eine Ebene, ganz bewusst: Wer das Passwort "Sadia" kennt, kann das Board benutzen **und** Kacheln hinzufügen/umbenennen/löschen. Es gibt keine getrennte "nur Eltern"-Stufe mehr — auch Sadia selbst könnte, sobald sie das Passwort kennt (sehr wahrscheinlich, es ist ihr eigener Name), den Admin-Bereich öffnen.

## Sicherheitshinweis

Bewusst in Kauf genommen für ein Familien-Spaßprojekt — aber es lohnt sich, den tatsächlichen Stand zu kennen, statt ihn milder zu formulieren als er ist:

Das Passwort "Sadia" ist **kein** Schutz für den Admin-Zugang. Es muss nicht erraten werden: Es steht im Klartext im Quelltext der Seite (`SITE_PASSWORD` in `index.html`), das Repo ist öffentlich, der Salt ist fest, und `data/admin.key` ist unter der Pages-URL frei abrufbar. Damit kann **jeder**, der die Seite findet, das GitHub-Token daraus zurückrechnen — und dieses Token hat Schreibrechte auf dieses Repo (Contents: read & write). Das ist die bewusst gewählte Gegenleistung dafür, dass kein Token pro Gerät eingegeben werden muss.

Praktische Konsequenz: Das Token gilt als öffentlich. Es sollte nur auf dieses eine Repo beschränkt sein (Only select repositories → `sadia-soundboard`, nur `Contents`) — dann ist der schlimmste Fall, dass jemand Fremdes in diesem Spaß-Repo Kacheln anlegt oder löscht.

Bei Verdacht auf Missbrauch: altes Token unter https://github.com/settings/personal-access-tokens widerrufen, dann im Zahnrad-Bereich über "Setup zurücksetzen" ein neues Token hinterlegen.

## Lokal testen

Da die Seite `data/tiles.json` per `fetch()` lädt, funktioniert das direkte Doppelklick-Öffnen von `index.html` in manchen Browsern nicht (CORS bei `file://`). Stattdessen im Projektordner:

```
python3 -m http.server 8000
```

und dann `http://localhost:8000` öffnen.

## Struktur

- `index.html` — die komplette App: HTML, CSS und JavaScript bewusst in **einer** Datei.
  Vorher lagen CSS/JS getrennt daneben; der Browser konnte dann ein frisches
  `index.html` mit einem veralteten `app.js` aus dem Cache kombinieren, wodurch der
  Admin-Bereich dauerhaft bei „Einen Moment…" hängen blieb. Mit einer Datei kann
  dieser Mischzustand nicht mehr entstehen — deshalb bitte nicht wieder aufteilen.
- `data/tiles.json` — Liste aller Kacheln (Name + Pfade zu Foto/Audio)
- `data/admin.key` — mit dem Passwort verschlüsseltes GitHub-Token (nur einmalig beim Setup angelegt)
- `media/` — die eigentlichen Fotos und Audiodateien, vom Admin-Panel aus befüllt

## Warum kein eigener Server

Bewusst 0 zusätzliche Infrastruktur: Hosting ist GitHub Pages (kostenlos), die "Datenbank" ist `data/tiles.json` im selben Repo, und der Schreibzugriff fürs Admin-Panel läuft direkt über die GitHub-API mit einem eng begrenzten, passwortverschlüsselten Token. Kein separates Backend, kein Account bei einem Drittanbieter nötig.
