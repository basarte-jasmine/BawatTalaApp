const fs = require('fs');

function patchHome() {
  const path = 'mobile-app/app/home.tsx';
  let code = fs.readFileSync(path, 'utf8');
  
  const search = setIsSavingMood(true);
    const result = await saveDailyMood(user.studentNumber, pendingMoodId, getManilaTodayParts().isoDate, "INPUT");
    setIsSavingMood(false);

    if (result.ok) {;
    
  const replacement = setIsSavingMood(true);
    try {
      const result = await saveDailyMood(user.studentNumber, pendingMoodId, getManilaTodayParts().isoDate, "INPUT");

      if (result.ok) {;
      
  const search2 =       setMoodSaveStatusTone("error");
      void loadTodayMood();
    }
  };;
  
  const replacement2 =       setMoodSaveStatusTone("error");
        void loadTodayMood();
      }
    } catch (e) {
      setMoodSaveStatus("Emotion was not saved. Please try again.");
      setMoodSaveStatusTone("error");
    } finally {
      setIsSavingMood(false);
    }
  };;

  if (code.includes(search)) {
    code = code.replace(search, replacement).replace(search2, replacement2);
    fs.writeFileSync(path, code);
    console.log("home.tsx patched!");
  } else {
    console.log("home.tsx search block not found.");
  }
}

function patchWriteEntry() {
  const path = 'mobile-app/app/write-entry.tsx';
  let code = fs.readFileSync(path, 'utf8');
  
  const search = setIsSavingJournalEmotion(true);
    setErrorMessage("");

    const result = await saveDailyMood(user.studentNumber, emotionId, getManilaTodayParts().isoDate, "JOURNAL");
    setIsSavingJournalEmotion(false);

    if (!result.ok) {;
    
  const replacement = setIsSavingJournalEmotion(true);
    setErrorMessage("");
    try {
      const result = await saveDailyMood(user.studentNumber, emotionId, getManilaTodayParts().isoDate, "JOURNAL");

      if (!result.ok) {;
      
  const search2 =     setStatusMessage("Emotion check-in saved for today.");
    setShowEmotionPicker(false);
  };;
  
  const replacement2 =       setStatusMessage("Emotion check-in saved for today.");
      setShowEmotionPicker(false);
    } catch (e) {
      setErrorMessage("Unable to save your emotion right now.");
    } finally {
      setIsSavingJournalEmotion(false);
    }
  };;

  if (code.includes(search)) {
    code = code.replace(search, replacement).replace(search2, replacement2);
    fs.writeFileSync(path, code);
    console.log("write-entry.tsx patched!");
  } else {
    console.log("write-entry.tsx search block not found.");
  }
}

patchHome();
patchWriteEntry();
