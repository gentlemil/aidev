```
/*
action: 'help',
response: {
  code: 120,
  message: 'OKO Editor API help.',
  status: 'success',
  command: 'help',
  description: 'Available commands and request syntax for okoeditor API.',
  commands: [
    {
      action: 'help',
      syntax: {
        apikey: 'YOUR_API_KEY',
        task: 'okoeditor',
        answer: {
          action: 'help',
        },
      },
      notes: ['Returns this help message.', 'No additional fields are required.'],
    },
    {
      action: 'update',
      syntax: {
        apikey: 'YOUR_API_KEY',
        task: 'okoeditor',
        answer: {
          page: 'incydenty|notatki|zadania',
          id: '32-char-hex-id',
          action: 'update',
          content: 'new description text (optional)',
          title: 'new title (optional)',
          done: 'YES|NO (only for page zadania, optional)',
        },
      },
      required_fields: ['page', 'id', 'action'],
      optional_fields: ['content', 'title', 'done'],
      rules: [
        'At least one of "content" or "title" must be provided.',
        '"done" is allowed only for page "zadania".',
        'Page "uzytkownicy" is read-only and cannot be updated.',
      ],
    },
    {
      action: 'done',
      syntax: {
        apikey: 'YOUR_API_KEY',
        task: 'okoeditor',
        answer: {
          action: 'done',
        },
      },
      notes: [
        'Verifies if all required data edits are completed.',
        'Returns a flag only when every condition is satisfied.',
      ],
    },
  ],
}
 */

/**
 * {
  "apikey": "{{AI_DEVS_KEY}}",
  "task": "okoeditor",
  "answer": {
    page: 'incydenty|notatki|zadania', // !
    id: '32-char-hex-id', // !
    action: 'update', // !

    content: 'new description text (optional)', //?
    title: 'new title (optional)', //?
    done: 'YES|NO (only for page zadania, optional)', //?
  }
}

Potrzebuje stworzyć agenta (nie musi korzystac z LLM, moze byc deterministycznie), ktory, najpierw wykonany request do API:
```
POST https://oko.ag3nts.org/
{
    "action": "login",
    "login": "Zofia",
    "password": "Zofia2026!",
    "access_key": "${AI_DEVS_KEY}"
}
```
Nastepnie wyciagnie wartosc (value) zapisana w w cookie pod nazwa 'oko_session' i posiadajac te wartosc wykonana drugie zapytanie do API:
```
GET https://oko.ag3nts.org/ 
Cookie na 'oko_session=value', 
```
i response zapisze do zmiennej 'response' i wyswietli na stronie.
Potrzebna jeszcze nam jeszcze strona UI, OkoEditor, dodaj nowy kafelek do AgentRegistry 


 */
```

Skorzystajmy z Playwright do zalogowania sie do panelu OKO, dodaj cala potrzebna do tego architekture:
- loguje się do https://oko.ag3nts.org/,
- przechodzi po widokach,
- zbiera informacje z UI:
- identyfikator raportu o Skolwin,
- identyfikator zadania o Skolwin