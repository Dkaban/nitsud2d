# Nitsud2D

**Nitsud2D** is a free, open-source, browser-based 2D game editor. Create scenes, arrange objects visually, tweak their properties, and test the result immediately in your browser.

[**Try the editor →**](https://dkaban.github.io/nitsud2d/)

## Features

- Dark-themed scene editor with interactive canvas and object hierarchy
- Built-in example forest with player, trees, rocks, wolf, chest and training dummy
- Add, select, drag, duplicate and delete scene objects
- Edit name, position, scale, rotation and collision settings in the inspector
- Optional grid, snap-to-grid, pan and zoom, and collision debugging
- Upload custom PNG, JPEG, WebP or GIF sprites, up to 2 MB each
- Play mode with WASD/arrow-key movement and basic solid-object collision
- Local browser autosave; export and import portable `.nitsud2d.json` projects
- No server, API key, account or paid services required

## Running locally

The first alpha has **no package installation requirements**.

Run a static web server from the project root. For example, with Python 3:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. You can also run the editor through GitHub Pages.

## Using the editor

Choose an object on the left and click on the canvas to place it. Select objects to drag them around or edit their values in the inspector. Use the mouse wheel to zoom, and Space + drag or middle mouse to pan.

Press **Play** to try moving the player with WASD or the arrow keys. Press **Stop** to go back to editing.

Save keeps the project in your browser. Export downloads a project JSON file that you can Open later, even on another computer.

## Status

Nitsud2D is an **early alpha**, not a full-fledged game engine yet. This release offers a functional editor and shared canvas/playtest runtime. Standalone exported games, tile painting, animation timeline, advanced combat, AI behavior trees, physics and isometric depth layers are **planned**, not implemented.

### Roadmap

1. Animation editor, sprite-sheet import, directional movement and animation states
2. Visual hitboxes/hurtboxes, combat events and gameplay components
3. Tiles, terrain brushes, layers, prefabs and world building
4. Scene transitions, multiple scenes and independent game export
5. Starter templates for top-down zombie survival and medieval isometric RPGs

## Tech

The current editor uses plain JavaScript, HTML and Canvas 2D. This keeps the first version fast to deploy and simple to study. Engine abstractions and component systems can be introduced as functionality grows.

## License

MIT.
