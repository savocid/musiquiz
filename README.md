# MusiQuiz

A music quiz game where you can create and play music trivia collections.

## Project Structure

```
musiquiz/
├── index.html          # Home page with Create/Play buttons
├── create.html         # Quiz collection submission form
├── play.html          # Collection selection and game settings
├── game.html          # Main game interface
├── css/
│   └── style.css      # All styles
├── js/
│   ├── app.js         # Collection selection logic
│   ├── create.js      # Form submission handler
│   └── game.js        # Game mechanics
├── audio/             # Store MP3 files organized by collection
│   └── example-collection/
├── data/
│   └── collections.json # Quiz collection data
└── README.md
```

## How to Use

### Playing Quizzes
1. Open `index.html`
2. Click "Play Quiz"
3. Select a collection
4. Choose your settings (lives, mode)
5. Start playing!

### Adding Collections

You have two options:

#### Option 1: Manually edit collections.json
Add your collection to `data/collections.json`:

```json
{
  "id": "unique-id",
  "title": "Collection Name",
  "description": "Description here",
  "difficulty": "medium",
  "clipDuration": 15,
  "guessTime": 10,
  "songs": [
    {
      "id": 1,
      "artist": "Artist Name",
      "title": "Song Title",
      "audioFile": "audio/collection-name/song1.mp3"
    }
  ]
}
```

Then add corresponding MP3 files to `audio/collection-name/`.

#### Option 2: User Submissions (via Google Sheets)

Users can suggest collections via the Create page. To set this up:

1. **Create a Google Sheet** with these columns:
   - Collection Title
   - Description
   - Difficulty
   - Song List
   - Clip Duration
   - Guess Time
   - Submitter Name
   - Submitter Email
   - Timestamp

2. **Create a Google Apps Script**:
   - In your Google Sheet, go to Extensions → Apps Script
   - Paste this code:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  
  sheet.appendRow([
    data.collectionTitle,
    data.description,
    data.difficulty,
    data.songList,
    data.clipDuration,
    data.guessTime,
    data.submitterName,
    data.submitterEmail,
    data.timestamp
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. **Deploy the script**:
   - Click "Deploy" → "New deployment"
   - Type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Copy the web app URL

4. **Update create.js**:
   - Open `js/create.js`
   - Replace `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` with your web app URL

Now user submissions will appear in your Google Sheet!

## Adding Audio Files

1. Create a folder in `audio/` named after your collection (e.g., `audio/90s-rock/`)
2. Add MP3 files to that folder
3. Reference them in `collections.json` as `audio/collection-name/filename.mp3`

**Note**: Make sure you have rights to use the audio files.

## GitHub Pages Deployment

1. Push all files to your repository
2. Go to Settings → Pages
3. Source: Deploy from branch `main`, folder `/root`
4. Your site will be at: `https://savocid.github.io/musiquiz/`

## Game Modes

- **Standard**: Guess the song title
- **Artist**: Guess the artist name
- **Both**: Guess both song title AND artist

## Features

- ✅ Customizable clip duration
- ✅ Adjustable guess time
- ✅ Lives system (1, 3, 5, or unlimited)
- ✅ Multiple game modes
- ✅ Score tracking
- ✅ User collection submissions
- ✅ Responsive design

## Next Steps

1. Add your first real collection to `collections.json`
2. Add MP3 files to the `audio/` folder
3. Set up Google Apps Script for user submissions (optional)
4. Test the game locally
5. Push to GitHub and deploy

Enjoy building your music quiz!
