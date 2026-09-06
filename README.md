![Raptor 1, Raptor 2 and Raptor 3 in side-by-side comparison](docs/images/raptor-comparison.jpg)

<h1 align="center">RAPTOR EXPLORER</h1>

<p align="center">
  Three generations of propulsion, opened up for exploration.
</p>

<p align="center">
  <a href="https://raptor-explorer-black.vercel.app/"><strong>Explore the live experience ↗</strong></a>
</p>

<p align="center">
  <strong>Three.js</strong> &nbsp;·&nbsp; WebGPU &nbsp;·&nbsp; TypeScript &nbsp;·&nbsp; MIT
</p>

<p align="center">
  <a href="#three-generations">The engines</a> &nbsp;/&nbsp;
  <a href="#the-experience">The experience</a> &nbsp;/&nbsp;
  <a href="#inside-the-project">Inside the project</a> &nbsp;/&nbsp;
  <a href="#license">License</a>
</p>

---

Raptor Explorer is an interactive 3D workbench for studying the visible architecture of SpaceX's Raptor engines. Move from the complete silhouette to a single flange, separate an assembly into its component groups, or place all three generations together for comparison.

The presentation puts the machinery first: a black studio, restrained typography, reflective metal, and controls that keep the model in view.

## Three generations

Each reconstruction has its own geometry, component atlas, and exterior character.

| Engine | Visual character | Modeled elements | Component groups |
| :--- | :--- | ---: | ---: |
| **Raptor&nbsp;1** | Dense exposed pipework, separate housings, and a layered upper assembly. | **8,068** | 64 |
| **Raptor&nbsp;2** | Tighter machinery, simpler routing, and a distinctive equipment housing. | **5,777** | 55 |
| **Raptor&nbsp;3** | Compact upper machinery and a cleaner, more integrated exterior. | **4,008** | 46 |

**17,853 modeled elements in total.** These counts describe the visual reconstructions, including repeated hardware and illustrative internal elements; they are not physical engine part counts.

## The experience

### Inspect at any scale

Orbit through 360°, pan across the assembly, and move into close inspection. Perspective and orthographic projections, five preset viewing angles, and automatic framing make it easy to move between an overall view and a specific detail.

The searchable component atlas connects the scene to named parts. Filter by engine system or search by name, group, and material, then isolate a component while the surrounding assembly fades into context.

### Take the assembly apart

Assembly separation and component spread have independent controls. Separate a single system, open up the complete engine, or play an animated sequence that unfolds and reassembles the model.

Individual elements can be translated and rotated along all three axes, hidden, revealed, and restored. Part rotations use each element's own center, including curved pipework.

### Look beneath the surface

| View | What it reveals |
| :--- | :--- |
| **Surface** | The assembled exterior, its silhouette, finishes, and exposed hardware. |
| **Cutaway** | An adjustable section through the model, with controls for the cut's angle and position. |
| **Internals** | Illustrative concealed components with the exterior faded back for context. |

Comparison mode brings Raptor 1, 2, and 3 into the same scene. Shared viewing controls make differences in proportions, routing, and exterior complexity easier to study.

## Inside the project

The engines are generated procedurally in TypeScript. Geometry and materials are shared through instancing, so repeated fasteners and fittings remain individually addressable without requiring a separate draw call for every element.

Three.js renders through WebGPU where available, with a WebGL 2 fallback. Eight shared material finishes use procedural machining grain, casting texture, subtle color variation, and directional reflections. A generated studio environment gives the metal continuous highlights; two lighting treatments change the emphasis of the scene.

<details>
<summary><strong>Explore the source</strong></summary>

| Area | Responsibility |
| :--- | :--- |
| [Engine geometry](src/raptor/geometry.ts) | Generation-specific assemblies, component identities, and system relationships. |
| [Materials and lighting](src/raptor/materials.ts) | Surface textures, physical materials, and the studio reflection environment. |
| [3D viewer](src/raptor/viewer.ts) | Rendering, instancing, picking, isolation, clipping, and camera transitions. |
| [Part articulation](src/raptor/pose.ts) | Assembly separation, component spread, and individual transforms. |
| [Camera framing](src/raptor/camera-fit.ts) | Model framing for perspective and orthographic views. |
| [Explorer interface](src/raptor/explorer.tsx) | React controls, component search, comparison, and inspection panels. |

</details>

## About the models

This is an independent visual reconstruction based on public SpaceX photographs. Exterior shapes and finishes are interpreted from those references. Hidden components and exploded arrangements are illustrative; the project is not official CAD, a service manual, or a verified inventory of engine parts.

## License

The project is available under the [MIT License](LICENSE). Bundled D-DIN fonts retain their [SIL Open Font License](public/fonts/d-din/COPYING.txt).
