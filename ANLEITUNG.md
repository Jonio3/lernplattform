# Lernplattform: Anleitung

## Passwortschutz
Der Lernstoff liegt **verschlüsselt** in `modules/<modul>/content.enc.js` (AES-256). Erst nach Eingabe
des Klassenpasswortes wird er im Browser entschlüsselt. Auf GitHub ist ohne Passwort nur Zeichensalat sichtbar.
Das Passwort steht in keiner Datei. In `modules/index.js` stehen nur ein Zufallswert und ein
verschlüsselter Prüftext (`window.LOCK`).

Was lokal bleibt und **nie** auf GitHub kommt (steht in `.gitignore`):
- `modules/<modul>/content.js`: der lesbare Lernstoff zum Bearbeiten
- `werkzeug/`: das Verschlüsselungs-Werkzeug
- `.claude/`: Einstellungen für den lokalen Test

## Lokal ausprobieren
`index.html` per Doppelklick öffnen und das Passwort eingeben. Es braucht keinen Server.

## Inhalte korrigieren
1. Den Lernstoff in `modules/<modul>/content.js` ändern.
2. `werkzeug/verschluesseln.html` per Doppelklick öffnen, Passwort eingeben, Modul-ID eintragen
   (Ordnername, z. B. `sowi-p2`) und die geänderte `content.js` wählen.
3. Die heruntergeladene `content.enc.js` in `modules/<modul>/` legen (alte Datei ersetzen).
4. Nur `content.enc.js` auf GitHub hochladen (bzw. committen und pushen).
   **Nie** `content.js` hochladen, sonst ist der Lernstoff öffentlich lesbar.

## Neues Modul hinzufügen
1. Ordner `modules/<neue-id>/` mit `content.js` anlegen (Aufbau wie die bestehenden Module).
2. Mit dem Werkzeug zu `content.enc.js` verschlüsseln (siehe oben).
3. In `modules/index.js` einen Eintrag mit derselben `id` ergänzen.
4. Optional für die Mindmaps: im Modul `mindmap` (Übersicht) und `maps` (Themen-Mindmaps)
   ergänzen, wie im bestehenden Modul.

## Passwort ändern
Im Werkzeug unter «Neues Passwort festlegen» eine neue Zeile erzeugen und damit die Zeile
`window.LOCK = …` in `modules/index.js` ersetzen. Danach **alle** Module mit dem neuen Passwort
neu verschlüsseln. Wer angemeldet war, muss sich neu anmelden.

## Hinweise
- Der Lernfortschritt wird pro Browser gespeichert, getrennt für jedes Modul.
- «Auf diesem Gerät angemeldet bleiben» speichert den Schlüssel im Browser. Auf fremden Geräten
  den Haken entfernen oder nach dem Lernen «Abmelden» wählen.
- Das Passwort ist so stark wie seine Länge: Ein kurzes Passwort hält Neugierige fern, aber
  nicht jemanden, der gezielt viel Rechenzeit investiert.
- Die Modulliste (Titel, Prüfungsdatum) in `modules/index.js` ist nicht verschlüsselt.
- GitHub Pages ist für Tests und nicht-kommerzielle Seiten gedacht, nicht für eine bezahlte Plattform.
