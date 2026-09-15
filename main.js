const config = {
  type: Phaser.CANVAS,
  parent: "friture-game",
  width: 1000,
  height: 950,
  backgroundColor: "#FFFFFF",
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

const menuHeight = 200;

let photoCanvas, photoLink;
let phaserGame, scene;
let tool, line;
let baseLineColor = 0xff0000;
let toolOffset = 0;
let frameOffset;
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
    "frame0",
    "frame1",
    "frameToggle",
    "fire0",
    "fire1",
    "fire2",
    "leaf0",
    "leaf1",
    "leaf2",
    "tool_fire",
    "tool_leaf",
    "tool_lines",
    "upload",
  ].forEach((name) => {
    this.load.image(name, `./images/${name}.png`);
  });

  photoCanvas = document.getElementById("photo-output");
  photoLink = document.getElementById("photo-link");
}

/* Generate initial game display on load. */
function create() {
  scene = this;

  createLayer("background").single = true;
  scene.drawingLayer = createLayer("drawing");
  scene.frameLayer = createLayer("frame");
  createLayer("ux").add(
    this.add.rectangle(500, 850, 1000, menuHeight, 0xeeffff),
  );

  scene.drawingCanvas = scene.add.renderTexture(
    config.width / 2,
    config.height / 2,
    config.width,
    config.height,
  );
  scene.drawingCanvas.saveTexture("drawing");
  scene.drawingLayer.add(scene.drawingCanvas);

  // Display default content.
  loadInitialScene();

  // Display UX.
  createButton(
    "reset",
    { x: 10, y: 770, width: 60, height: 60 },
    loadInitialScene,
  );

  ["lines", "fire", "leaf"].forEach((tool, index) => {
    createTool(tool, { x: 150 + index * 120, y: 775, width: 50, height: 50 });
  });

  scene.palette = scene.add.container();

  let selection = scene.add
    .graphics()
    .fillStyle(baseLineColor * 0.8, 1)
    .fillRoundedRect(156, 856, 48, 48, 15);
  scene.palette.add(selection);

  [baseLineColor, 0x00ff00, 0x00ffff, 0xff00ff].forEach((color, i) => {
    scene.palette.add(
      scene.add
        .graphics()
        .fillStyle(color, 1)
        .fillRoundedRect(160 + i * 50, 860, 40, 40, 12),
    );
    createButton(
      "blank",
      {
        x: 156 + i * 50,
        y: 856,
        width: 40,
        height: 40,
        pointerOver: () => {},
        pointerOut: () => {},
      },
      () => {
        baseLineColor = color;
        selection.x = 150 + i * 50;
        selection
          .clear()
          .fillStyle(color * 0.8, 1)
          .fillRoundedRect(6, 856, 48, 48, 15);
      },
    ).alpha = 0.1;
  });

  // Add frame toggle.
  createButton("frameToggle", { x: 510, y: 775, width: 50, height: 50 }, () => {
    scene.frameLayer.removeAll();
    if (frameOffset < 2) {
      createImage("frame" + frameOffset, { layer: "frame" });
    }
    frameOffset = (frameOffset + 1) % 3;
  });

  createButton(
    "camera",
    { x: 930, y: 765, width: 60, height: 60 },
    takePicture,
  );

  // Allow image upload.
  const imageUpload = document.getElementById("imageInput");
  createButton("upload", { x: 850, y: 765, width: 60, height: 60 }, () =>
    imageUpload.click(),
  );

  let img = new Image();
  img.onload = (_) => {
    scene.textures
      .createCanvas("localFile", img.width, img.height)
      .draw(0, 0, img);

    const scale = Math.min(1, (config.height - menuHeight) / img.height);
    createImage("localFile", {
      width: config.width * scale,
      height: (config.height - menuHeight) * scale,
      layer: "background",
    });
  };

  imageUpload.addEventListener("change", async () => {
    createImage("blank", { layer: "background" });
    if (scene.textures.exists("localFile")) scene.textures.remove("localFile");

    const [image] = imageUpload.files;
    if (image) {
      let reader = new FileReader();
      reader.onload = function (_e) {
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
  const xDiff = scene.cursor.x - this.input.activePointer.worldX;
  const yDiff = scene.cursor.y - this.input.activePointer.worldY;
  const thickness = Math.sqrt((xDiff ^ 2) + (yDiff ^ 2)).toRange(1.5, 12) / 1.5;
  scene.cursor.x = this.input.activePointer.worldX;
  scene.cursor.y = this.input.activePointer.worldY;

  scene.cursor.alpha = scene.cursor.y < config.height - menuHeight ? 1 : 0;

  if (
    this.input.activePointer.isDown &&
    scene.cursor.y < config.height - menuHeight
  ) {
    toolOffset++;
    if ((tool == "fire" || tool == "leaf") && toolOffset % 2) {
      let name = tool + (toolOffset % 3);
      let element = null;
      if (tool == "leaf") {
        element = scene.add.image(0, 0, name);
        element.angle = toolOffset * 3;
      }

      scene.drawingCanvas.draw(
        element ?? name,
        scene.cursor.x - 20,
        scene.cursor.y - 35,
      );
      element?.destroy();

      toolOffset %= 72;
    } else if (tool == "lines") {
      if (line == null) {
        line = this.add.graphics();
        line.beginPath();
        scene.drawingLayer.add(line);
      }

      line.lineStyle(
        thickness,
        baseLineColor + 0x000200 * (toolOffset % (0xff / 2)),
        1,
      );
      line.lineTo(scene.cursor.x, scene.cursor.y);
      line.moveTo(scene.cursor.x, scene.cursor.y);
      line.closePath();
      line.strokePath();
    }
  } else {
    if (line) {
      scene.drawingCanvas.draw(line, 0, 0);
      line.destroy();
      line = null;
    }
  }
}

/* Display first available background, clearing previous content. */
function loadInitialScene() {
  createImage("blank", { layer: "background" });

  scene.drawingCanvas.clear();
  scene.frameLayer.removeAll();
  frameOffset = 0;

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
  let image = new Image();
  image.src = phaserGame.canvas.toDataURL();
  setTimeout(() => {
    try {
      photoCanvas.getContext("2d").drawImage(image, 0, 0);
      photoLink.href = photoCanvas.toDataURL();
      photoLink.click();

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
 * @returns {Image} The created image with attached interactive logic.
 */
function createTool(name, options = {}) {
  options.pointerOver = () => (toolItem.alpha = 1);
  options.pointerOut = () => (toolItem.alpha = toolItem.name == tool ? 1 : 0.5);

  let toolItem = createButton("tool_" + name, options, () => setTool(name));
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

  scene.palette.alpha = tool == "lines" ? 1 : 0;
}

Number.prototype.toRange = function (min, max) {
  return Math.max(min, Math.min(max, this));
};
