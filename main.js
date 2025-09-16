const config = {
  type: Phaser.CANVAS,
  parent: "friture-game",
  width: 1000,
  height: 750,
  backgroundColor: "#FFFFFF",
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

let phaserGame, scene, tool, line, toolOffset;
let layers = [];
let images = [];
let menuOptions = [];

// Load room content and image references before starting game.
phaserGame = new Phaser.Game(config);
phaserGame.preserveDrawingBuffer = true;

/* Load game textures during game setup. */
function preload() {
  // Load UI.
  [
    "reset",
    "toggle",
    "blank",
    "camera",
    "brush",
    "frame",
    "frameToggle",
    "fire0",
    "fire1",
    "fire2",
    "lines",
    "upload",
  ].forEach((name) => {
    this.load.image(name, `./images/${name}.png`);
  });
}

/* Generate initial game display on load. */
function create() {
  scene = this;

  createLayer("background").single = true;
  scene.frameLayer = createLayer("frame");
  createLayer("ux").add(this.add.rectangle(500, 700, 1000, 100, 0xeeffff));

  // Display default content.
  loadInitialScene();

  // Display UX.
  createButton(
    "reset",
    { x: 10, y: 670, width: 60, height: 60 },
    loadInitialScene
  );

  ["lines", "fire0"].forEach((tool, index) => {
    createTool(tool, { x: 150 + index * 120, y: 675, width: 50, height: 50 });
  });

  // Add frame toggle.
  createImage("frame", { layer: "frame" });
  scene.frameLayer.alpha = 0;

  createButton(
    "frameToggle",
    { x: 390, y: 675, width: 50, height: 50 },
    () => (scene.frameLayer.alpha = 1 - scene.frameLayer.alpha)
  );

  createButton(
    "camera",
    { x: 930, y: 665, width: 60, height: 60 },
    takePicture
  );

  // Allow image upload.
  const imageUpload = document.getElementById("imageInput");
  createButton("upload", { x: 850, y: 665, width: 60, height: 60 }, () =>
    imageUpload.click()
  );

  let img = new Image();
  img.onload = (_) => {
    scene.textures
      .createCanvas("localFile", img.width, img.height)
      .draw(0, 0, img);

    createImage("localFile", {
      x: (config.width - img.width) / 2,
      y: (config.height - img.height) / 2,
      layer: "background",
    });
  };

  imageUpload.addEventListener("change", async () => {
    createImage("blank", { layer: "background" });
    scene.textures.remove("localFile");

    const [image] = imageUpload.files;
    if (image) {
      let reader = new FileReader();
      reader.onload = function (e) {
        img.src = reader.result;
      };
      reader.readAsDataURL(image);
    }
  });

  // Add mouse.
  scene.cursor = createImage("brush", { layer: "ux" });
  setTool("lines");
}

/* Follow mouse with drawings. */
function update() {
  scene.cursor.x = this.input.activePointer.worldX;
  scene.cursor.y = this.input.activePointer.worldY;

  scene.cursor.alpha = scene.cursor.y < 650 ? 1 : 0;

  if (this.input.activePointer.isDown && scene.cursor.y < 650) {
    if (tool == "fire0") {
      if (toolOffset % 7 == 0) {
        images.push(
          createImage("fire" + (toolOffset % 3), {
            x: scene.cursor.x - 20,
            y: scene.cursor.y - 35,
          })
        );
      }
      toolOffset %= 21;
    } else if (tool == "lines") {
      if (line == null) {
        line = this.add.graphics();
        line.beginPath();
        images.push(line);
      }
      line.lineStyle(8, 0xff0000 + 0x000200 * (toolOffset % (0xff / 2)), 1);
      line.lineTo(scene.cursor.x, scene.cursor.y);
      line.moveTo(scene.cursor.x, scene.cursor.y);
      line.closePath();
      line.strokePath();
    }
    toolOffset++;
  } else {
    line?.save();
    line = null;
    toolOffset = 0;
  }
}

/* Display first available background, clearing previous content. */
function loadInitialScene() {
  createImage("blank", { layer: "background" });
  // Clear layered images.
  layers.forEach((layer) => {
    if (layer.temporary) {
      layer.removeAll();
    }
  });

  // Clear unsorted images.
  images.forEach((element) => {
    element?.destroy();
    element = null;
  });

  images = [];
}

/* Convert canvas data to screenshot. */
function takePicture() {
  let ux = layers.find((x) => x.name == "ux");
  ux.alpha = 0;

  // Attempt to take a screenshot.
  setTimeout(() => {
    try {
      let button = document.createElement("a");
      button.href = phaserGame.canvas.toDataURL();
      button.download = "friture";
      document.body.appendChild(button);
      button.click();
      document.body.removeChild(button);

      ux.alpha = 1;
    } catch {
      console.log("Failed to capture screenshot.");
    }
  }, 15);
}

/**
 * Generate a layer tied to a top-level array.
 *
 * @param {string} name - The name to associate with the layer.
 * @returns {layer} layer - The new Phaser layer.
 */
function createLayer(name) {
  let layer = scene.add.layer();
  layer.name = name;
  layers.push(layer);

  return layer;
}

/**
 * Display a Phaser image.
 *
 * @param {string} name - The image key to load.
 * @param {Object} options - Further image properties.
 * @returns {Image} The displayed Phaser image.
 */
function createImage(name, options = {}) {
  let image = scene.add.image(options.x, options.y, name).setOrigin(0, 0);

  if (options.width && options.height) {
    const source = scene.textures.get(name).getSourceImage();

    const scaleX = options.width / source.width;
    const scaleY = options.height / source.height;
    options.preserveAspect
      ? image.setScale(Math.min(scaleX, scaleY))
      : image.setScale(scaleX, scaleY);
  }

  let parent = layers.find((x) => x.name == options.layer);
  if (parent) {
    if (parent.single) {
      parent.removeAll();
    }
    parent.add(image);
  } else {
    images.push(image);
  }

  return image;
}

/**
 * Display a Phaser image as if it were a clickable button.
 *
 * @param {string} name
 * @param {Object} options
 * @param {Function} action
 * @returns {Image} The created image with attached interactive logic.
 */
function createButton(name, options = {}, action) {
  options.layer = "ux";

  let button = createImage(name, options)
    .setInteractive()
    .setAlpha(0.5)
    .on("pointerover", options.pointerOver || (() => (button.alpha = 1)))
    .on("pointerout", options.pointerOut || (() => (button.alpha = 0.5)))
    .on("pointerup", action);

  return button;
}

/**
 * Display a Phaser image as a selectable tool option.
 *
 * @param {string} name
 * @param {Object} options
 * @param {Function} action
 * @returns {Image} The created image with attached interactive logic.
 */
function createTool(name, options = {}, action) {
  options.pointerOver = () => (toolItem.alpha = 1);
  options.pointerOut = () => (toolItem.alpha = toolOffset == name ? 0.5 : 1);

  let toolItem = createButton(name, options, () => setTool(name));
  toolItem.name = name;
  menuOptions.push(toolItem);

  return toolItem;
}

/**
 * Select the current tool out of all menu options.
 *
 * @param {String} toolName - The tool to select.
 */
function setTool(toolName) {
  tool = toolName;
  menuOptions.forEach((menuOption) => {
    menuOption.alpha = tool == menuOption.name ? 1 : 0.5;
  });
}
