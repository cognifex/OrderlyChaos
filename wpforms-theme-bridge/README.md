# WPForms Theme Styling Bridge

Dieses Plugin sorgt dafür, dass WPForms-Felder automatisch die Formular-Styles des aktiven Themes erben. Es verändert keine Felder oder Texte, sondern nur die Darstellung.

## Nutzung
1. Lege den Ordner `wpforms-theme-bridge` in dein WordPress-Verzeichnis `wp-content/plugins/`.
2. Aktiviere das Plugin im WordPress-Backend.
3. Öffne eine Seite mit einem WPForms-Formular – Felder, Labels und Buttons nutzen jetzt die Theme-Styles.

## Funktionsweise
- Lädt ein kleines Stylesheet, das Typografie, Abstände und Fokus-States von Standard-Formularen übernimmt.
- Fügt eine Body-Klasse `wpforms-theme-bridge-active` hinzu, sodass das Styling nur bei aktivem Plugin greift.
- Lädt nichts, wenn WPForms nicht aktiv ist.

## Anpassen
Passe bei Bedarf die CSS-Werte in `assets/css/wpforms-theme-bridge.css` an (z. B. Abstände, Fokus-Farben oder Button-Hover).
