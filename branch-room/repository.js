window.PRINT_ROOM = {
  "tips": {
    "main": "25f8514",
    "develop": "7e96938",
    "feature/last-entry": "00e5c91"
  },
  "trees": {
    "main": {
      "desk/door-sign.txt": "Morrow Print Room\nLast entry 17:00\nDoors close 18:00",
      "program/workshops.txt": "Saturday programme\n10:00  Open press"
    },
    "develop": {
      "desk/door-sign.txt": "Morrow Print Room\nLast entry 17:00\nDoors close 18:00",
      "program/workshops.txt": "Saturday programme\n10:00  Open press\n14:00  Indigo ink workshop"
    },
    "feature/last-entry": {
      "desk/door-sign.txt": "Morrow Print Room\nLast entry 17:30\nDoors close 18:00",
      "program/workshops.txt": "Saturday programme\n10:00  Open press\n14:00  Indigo ink workshop"
    }
  },
  "comparisons": {
    "main": {
      "commits": [
        "7e96938 Draft the indigo ink workshop",
        "00e5c91 Give visitors thirty more minutes"
      ],
      "diffs": {
        "desk/door-sign.txt": "diff --git a/desk/door-sign.txt b/desk/door-sign.txt\nindex 257fef0..228480b 100644\n--- a/desk/door-sign.txt\n+++ b/desk/door-sign.txt\n@@ -1,3 +1,3 @@\n Morrow Print Room\n-Last entry 17:00\n+Last entry 17:30\n Doors close 18:00",
        "program/workshops.txt": "diff --git a/program/workshops.txt b/program/workshops.txt\nindex 0191db8..1d1ff1c 100644\n--- a/program/workshops.txt\n+++ b/program/workshops.txt\n@@ -1,2 +1,3 @@\n Saturday programme\n 10:00  Open press\n+14:00  Indigo ink workshop"
      }
    },
    "develop": {
      "commits": [
        "00e5c91 Give visitors thirty more minutes"
      ],
      "diffs": {
        "desk/door-sign.txt": "diff --git a/desk/door-sign.txt b/desk/door-sign.txt\nindex 257fef0..228480b 100644\n--- a/desk/door-sign.txt\n+++ b/desk/door-sign.txt\n@@ -1,3 +1,3 @@\n Morrow Print Room\n-Last entry 17:00\n+Last entry 17:30\n Doors close 18:00"
      }
    }
  },
  "log": [
    "25f8514 Put the opening hours on the door",
    "7e96938 Draft the indigo ink workshop",
    "00e5c91 Give visitors thirty more minutes"
  ],
  "merged": {
    "tip": "00e5c91",
    "develop": {
      "desk/door-sign.txt": "Morrow Print Room\nLast entry 17:30\nDoors close 18:00",
      "program/workshops.txt": "Saturday programme\n10:00  Open press\n14:00  Indigo ink workshop"
    },
    "main": {
      "desk/door-sign.txt": "Morrow Print Room\nLast entry 17:00\nDoors close 18:00",
      "program/workshops.txt": "Saturday programme\n10:00  Open press"
    },
    "review": {
      "commits": [],
      "diffs": {}
    }
  }
};
