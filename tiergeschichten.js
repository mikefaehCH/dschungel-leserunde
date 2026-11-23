const jungleStories = [
  {
    id: "elefant",
    name: "Elefant",
    title: "Die singende Brücke",
    syllable: "LA",
    ending: "Die Brücke singt",
    scenes: [
      "Der Elefant steht vor einer Brücke. Sie klingt nur bei LA. Höre LA und finde dieselbe Silbe.",
      "Ein Brett beginnt zu singen. Der Elefant hebt seinen Fuss. Finde noch einmal LA.",
      "Jetzt singt die ganze Brücke. Ein letztes LA bringt den Elefanten ans andere Ufer.",
      "Am Ufer fehlt das Schild. Setze LA zusammen. Erst L, dann A.",
      "Für wen ist die Brücke? Finde LA in LAMA.",
      "Der Elefant trompetet. Das Lama tanzt über die singende Brücke. Du hast beiden geholfen.",
    ],
  },
  {
    id: "schildkroete",
    name: "Schildkröte",
    title: "Der schwimmende Garten",
    syllable: "MA",
    ending: "Ein Garten für Mama",
    scenes: [
      "Die Schildkröte möchte Mama einen Garten schenken. Jedes MA lässt eine Blume wachsen. Finde MA.",
      "Die erste Blume öffnet sich. Ein Schmetterling setzt sich darauf. Finde noch einmal MA.",
      "Noch eine Blume! Die Schildkröte trägt den Garten auf ihrem Panzer. Finde ein letztes MA.",
      "Die Schleife ist offen. Verbinde M und A zu MA.",
      "Auf dem Geschenk steht MAMA. In welchem Wort findest du MA?",
      "Mama staunt. Der Garten schwimmt auf dem Panzer mit. Die Schildkröte schenkt dir eine Blume.",
    ],
  },
  {
    id: "schlange",
    name: "Schlange",
    title: "Das verschwundene Echo",
    syllable: "MI",
    ending: "Mimi hat das Echo",
    scenes: [
      "Die Schlange hört MI aus einer Höhle. Doch ihr Echo ist weg. Hilf ihr und finde MI.",
      "Eine kleine Glühspur leuchtet auf. Die Schlange schlängelt hinterher. Finde noch einmal MI.",
      "Die Spur führt um einen Stein. Noch ein MI zeigt den Eingang zur Höhle.",
      "Am Eingang liegen zwei Buchstaben. Setze M und I zu MI zusammen.",
      "Wer ruft aus der Höhle? Finde MI in MIMI.",
      "Mimi lacht in der Höhle. Sie hat das Echo nachgemacht. Jetzt rufen beide MI zurück.",
    ],
  },
  {
    id: "schmetterling",
    name: "Schmetterling",
    title: "Der Brief auf dem Blatt",
    syllable: "LA",
    ending: "Ein Brief für das Lama",
    scenes: [
      "Der Schmetterling trägt einen Brief auf einem Blatt. LA zeigt ihm den Weg. Finde LA.",
      "Ein Windstoss dreht das Blatt. Der Schmetterling hält es fest. Finde noch einmal LA.",
      "Hinter den Blumen wartet jemand. Ein letztes LA bringt den Brief über die Wiese.",
      "Auf dem Blatt fehlen Buchstaben. Verbinde L und A zu LA.",
      "Wem gehört der Brief? Finde LA in LAMA.",
      "Das Lama öffnet den Brief. Darin steckt eine Einladung zum Blumenfest. Der Schmetterling darf mitkommen.",
    ],
  },
  {
    id: "faultier",
    name: "Faultier",
    title: "Die kitzlige Hängematte",
    syllable: "MA",
    ending: "Platz für zwei",
    scenes: [
      "Das Faultier möchte Mama einen Platz in seiner Hängematte machen. MA öffnet einen Knoten. Finde MA.",
      "Der erste Knoten löst sich. Ein Blatt kitzelt das Faultier am Bauch. Finde noch einmal MA.",
      "Das Faultier muss lachen. Ein letztes MA macht die Hängematte breit genug.",
      "Am letzten Knoten stehen zwei Buchstaben. Verbinde M und A zu MA.",
      "Wer darf sich dazulegen? Finde MA in MAMA.",
      "Mama kuschelt sich dazu. Das Faultier schaukelt ganz langsam. Nur das Blatt kitzelt immer noch.",
    ],
  },
  {
    id: "krokodil",
    name: "Krokodil",
    title: "Das Konzert im Schilf",
    syllable: "MI",
    ending: "Mimis Schilfkonzert",
    scenes: [
      "Das Krokodil baut ein Konzert aus Schilfhalmen. MI bringt den ersten Halm zum Klingen. Finde MI.",
      "Ein Halm spielt ganz schief. Das Krokodil kichert. Finde noch einmal MI.",
      "Jetzt klingt es wie eine kleine Flöte. Ein letztes MI stimmt den höchsten Halm.",
      "Für das Lied fehlen zwei Buchstaben. Verbinde M und I zu MI.",
      "Wer singt heute mit? Finde MI in MIMI.",
      "Mimi singt und das Krokodil begleitet sie. Sogar der Frosch hört zu. Das Schilfkonzert beginnt.",
    ],
  },
];
function storyClip(story, step) {
  return "tier-" + story.id + "-" + step;
}
function storyRecordings(story) {
  return story.scenes.map((_, index) => storyClip(story, index));
}
