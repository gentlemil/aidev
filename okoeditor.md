Zadanie s04e01 Wwdrozenia Rozwiazan AI. Patrz plik ai_devs_lessons/S04/s04e01-wdrozenia-rozwiazan-ai.md

# Instrukcje do zadania

Twoim zadaniem jest wprowadzenie zmian w Centrum Operacyjnym OKO za pomocą API wystawionego przez centralę.

Lista zadan do wykonania:

1. Zmień klasyfikację raportu o mieście Skolwin tak, aby nie był to raport o widzianych pojazdach i ludziach, a o zwierzętach.

2. Na liście zadań znajdź zadanie związane z miastem Skolwin i oznacz je jako wykonane. W jego treści wpisz, że widziano tam jakieś zwierzęta np. bobry.

3. Musimy przekierować uwagę operatorów na inne, niezamieszkałe miasto, aby ocalić Skolwin. Spraw więc, aby na liście incydentów pojawił się raport o wykryciu ruchu ludzi w okolicach miasta Komarowo.

4. Gdy to wszystko wykonasz, uruchom akcję "done".

## I Logowanie się do systemu.

request: `POST https://oko.ag3nts.org/`,
body:

```
{
  login: "Zofia"
  password: "Zofia2026!"
  "apikey": "***"
}
```

## II Istrukcje API

`POST https://hub.ag3nts.org/verify`
Request:

```
{
  "apikey": "{{AI_DEVS_KEY}}",
  "task": "okoeditor",
  "answer": {
    "action": "help"
  }
}
```

Response:

```
"commands": [
  {
      "action": "help",
      "syntax": {
          "apikey": "YOUR_API_KEY",
          "task": "okoeditor",
          "answer": {
              "action": "help"
          }
      },
      "notes": [
          "Returns this help message.",
          "No additional fields are required."
      ]
  },
  {
      "action": "update",
      "syntax": {
          "apikey": "YOUR_API_KEY",
          "task": "okoeditor",
          "answer": {
              "page": "incydenty|notatki|zadania",
              "id": "32-char-hex-id",
              "action": "update",
              "content": "new description text (optional)",
              "title": "new title (optional)",
              "done": "YES|NO (only for page zadania, optional)"
          }
      },
      "required_fields": [
          "page",
          "id",
          "action"
      ],
      "optional_fields": [
          "content",
          "title",
          "done"
      ],
      "rules": [
          "At least one of \"content\" or \"title\" must be provided.",
          "\"done\" is allowed only for page \"zadania\".",
          "Page \"uzytkownicy\" is read-only and cannot be updated."
      ]
  },
  {
      "action": "done",
      "syntax": {
          "apikey": "YOUR_API_KEY",
          "task": "okoeditor",
          "answer": {
              "action": "done"
          }
      },
      "notes": [
          "Verifies if all required data edits are completed.",
          "Returns a flag only when every condition is satisfied."
      ]
  }
]
```

## II Scappowanie strony

1. Przejdz do strony /notatki (`https://oko.ag3nts.org/notatki`)

- Przejdź przez wszystkie istrukcje (znajdz na stronie listę), otwórz szczególy kazdej podstrony (np. `https://oko.ag3nts.org/notatki/380792b2c86d9c5be670b3bde48e187b`). Skopiuj treść i zapisz do pliku markdown (np. metody-kodowania-incydentow.md) itd.
- Instrukcje przechowuj w pliku /instructions.
- Nie wolno ci edytowac ani usuwac notatek.

2. Przejdz do strony /notatki (`https://oko.ag3nts.org/incydenty`)

- Przeanalizuj wszystkie incydenty. Zapisz wszystkie incydenty w pliku `incydenty.json`
  zachowujac format json:

```
type Incydent {
  id: string,
  title: string,
  content: string
}
```

3. Przejdz do strony /notatki (`https://oko.ag3nts.org/zadania`)

- Przeanalizuj wszystkie zadania. Zapisz wszystkie zadania w pliku `zadania.json`
  zachowujac format json:

```
type Zadanie {
  id: string,
  title: string,
  content: string,
  done: 'YES' | 'NO'
}
```

## III. Edycja danych

1. Przeanalizuj incydenty, znajdz ten, ktory wspomina o miescie Skolwin. Zmien klasyfikację raportu tak, aby nie był to raport o widzianych pojazdach i ludziach, a o zwierzętach (patrz na plik `instructions.md`, ktory wczesniej przygotowal agent). Pamietaj o edycji `title` jak rowniez `content`.
   Wykonaj odpowiedni request (patrz _II Istrukcje API_). Jesli w response otrzymasz:
   `"message": "Entry updated successfully.",` udalo sie.

2. Przeanalizuj raz jeszcze incydenty. Wybierz jakis incydent mówiący i badaniu zdobytej próbki (`PROB`). Musimy przekierować uwagę operatorów na inne, niezamieszkałe miasto, aby ocalić Skolwin. Spraw więc, aby na liście incydentów pojawił się raport o wykryciu ruchu ludzi w okolicach miasta Komarowo. Zmien odpowiednio `title` oraz `content`. Wykonaj odpowiedni request.

3. Nastepnie przeszukaj liste zadań i znajdź zadanie związane z miastem 'Skolwin' i oznacz je jako wykonane. W jego treści wpisz, że widziano tam jakieś zwierzęta np. bobry.
   Wykonaj odpowiedni request (patrz _II Istrukcje API_). Jesli w response otrzymasz:
   `"message": "Entry updated successfully.",` udalo sie.

4. Na koniec nalezy uruchic akcję "done". Wykonaj request.
   `POST https://hub.ag3nts.org/verify`

```
{
  "apikey": "{{AI_DEVS_KEY}}",
  "task": "okoeditor",
  "answer": {
    "action": "done"
  }
}
```

Jesli w response otrzymales {FLG:\*\*\*}, zadanie zostalo wykonane poprawnie.

## IV. Dodatkowe wskazówki dotyczace flow.

Stworz subagentow AI, ktorzy beda wykonanywac kolejne akcje. Skorzystaj ze Structured Output to wygenerowania plikow instrukcje.json i zadania.json. Stworz osobnego agenta, ktory bedzie analizowal dane (openrouter, openai/gpt-4o), osobnego agenta, ktory bedzie wykonywal prostsze akcje (openrouter, openai/gpt-4o-mini). Przygotuj odpowiedni UI.

Czesciowo zadanie zostalo juz zaimplementowane (patrz foldery /okoeditor).
Logowanie sie do systemu dziala prawidlowo. Pozostala czesc nie dziala prawidlowo, mozesz ja usunac.

Scrapper moze skorzystac z url https://oko.ag3nts.org/ w celu przeklikania stronyu www albo wykonujac logowanie
