/* Three.js game scenes · no external runtime requests */
(() => {
  'use strict';
  const THREE = window.THREE;
  if (!THREE) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const createView = (mount, options = {}) => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = options.exposure || 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', options.label || '3D 游戏画面');
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    if (options.background) scene.background = new THREE.Color(options.background);
    if (options.fog) scene.fog = new THREE.Fog(options.fog.color, options.fog.near, options.fog.far);

    const camera = new THREE.PerspectiveCamera(options.fov || 33, 1, 0.1, 120);
    camera.position.fromArray(options.camera || [0, 0.9, 5.7]);
    camera.lookAt(new THREE.Vector3(...(options.lookAt || [0, 0, 0])));

    const hemi = new THREE.HemisphereLight(options.hemiSky || '#fffdf4', options.hemiGround || '#8db9ca', 1.5);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight('#ffffff', 0.38);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#fff6e2', 2.25);
    key.position.set(-3.7, 5.2, 5.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.0015;
    scene.add(key);
    const rim = new THREE.PointLight(options.rimColor || '#ffcfaa', 1.25, 18, 2);
    rim.position.set(3.8, 1.8, 3.1);
    scene.add(rim);

    let active = false;
    let raf = 0;
    let update = null;
    const clock = new THREE.Clock();
    let resizeObserver = null;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
    }
    window.addEventListener('resize', resize);

    const loop = () => {
      if (!active) return;
      raf = requestAnimationFrame(loop);
      const delta = Math.min(clock.getDelta(), 0.05);
      if (update) update(delta, clock.elapsedTime);
      renderer.render(scene, camera);
    };

    const activate = () => {
      if (active) return;
      active = true;
      resize();
      clock.start();
      clock.getDelta();
      loop();
    };

    const deactivate = () => {
      active = false;
      cancelAnimationFrame(raf);
    };

    return {
      THREE, renderer, scene, camera, mount, clock,
      setUpdate(fn) { update = fn; },
      activate, deactivate, resize
    };
  };

  const makeShapeGeometry = (kind) => {
    const shape = new THREE.Shape();
    if (kind === 'heart') {
      shape.moveTo(0, -1.14);
      shape.bezierCurveTo(-1.35, -0.15, -1.2, 1.03, -0.3, 1.03);
      shape.bezierCurveTo(0.03, 1.03, 0.22, 0.84, 0.34, 0.63);
      shape.bezierCurveTo(0.5, 1.0, 1.26, 1.08, 1.34, 0.1);
      shape.bezierCurveTo(1.38, -0.58, 0.64, -0.95, 0, -1.14);
    } else if (kind === 'star') {
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? 1.35 : 0.58;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
    } else if (kind === 'flower') {
      for (let i = 0; i < 160; i += 1) {
        const angle = i / 160 * Math.PI * 2;
        const radius = 1.12 + 0.18 * Math.cos(angle * 8);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
    } else if (kind === 'circle') {
      shape.absarc(0, 0, 1.18, 0, Math.PI * 2, false);
    } else if (kind === 'bean') {
      shape.absellipse(0, 0, 1.3, 0.92, 0, Math.PI * 2, false, 0);
      shape.closePath();
    } else {
      shape.moveTo(-1.15, -0.38);
      shape.bezierCurveTo(-1.58, -0.52, -1.55, 0.38, -0.95, 0.46);
      shape.bezierCurveTo(-0.8, 1.18, 0.15, 1.28, 0.38, 0.62);
      shape.bezierCurveTo(0.76, 1.04, 1.45, 0.83, 1.24, 0.26);
      shape.bezierCurveTo(1.64, -0.03, 1.33, -0.61, 0.86, -0.56);
      shape.bezierCurveTo(0.58, -0.87, -0.56, -0.94, -1.15, -0.38);
      shape.closePath();
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.52,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      curveSegments: 36
    });
    geometry.center();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  };

  const addSoftShadowPlane = (scene, y = -1.55, radius = 2.5) => {
    const plane = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 64),
      new THREE.ShadowMaterial({ color: '#385b72', opacity: 0.16 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    plane.receiveShadow = true;
    scene.add(plane);
    return plane;
  };

  const setupOrbitPointer = (view, target) => {
    const canvas = view.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drag = null;
    let moved = false;
    let rotationX = -0.08;
    let rotationY = 0.18;

    const setPointer = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, view.camera);
    };

    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      drag = { x: event.clientX, y: event.clientY };
      moved = false;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      rotationY += dx * 0.009;
      rotationX = clamp(rotationX + dy * 0.007, -0.7, 0.7);
      drag.x = event.clientX;
      drag.y = event.clientY;
    });

    const end = (event) => {
      if (!drag) return;
      drag = null;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
      if (!moved) {
        setPointer(event);
        const hits = raycaster.intersectObjects(target.getIntersectables(), true);
        if (hits.length) {
          const hit = hits[0];
          const local = target.group.worldToLocal(hit.point.clone());
          let localNormal = local.clone().normalize();
          if (hit.face && hit.face.normal) {
            const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            const localAhead = target.group.worldToLocal(hit.point.clone().add(worldNormal.multiplyScalar(0.12)));
            const derived = localAhead.sub(local);
            if (derived.lengthSq() > 0.000001) localNormal = derived.normalize();
          }
          target.onClick(local, localNormal, hit);
        }
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    return {
      update() {
        target.group.rotation.x += (rotationX - target.group.rotation.x) * 0.08;
        target.group.rotation.y += (rotationY - target.group.rotation.y) * 0.08;
      }
    };
  };

  const createSquishy3D = (mount) => {
    const view = createView(mount, { camera: [0, 0.45, 5.25], lookAt: [0, 0, 0], fov: 34, exposure: 1.1 });
    const modelGroup = new THREE.Group();
    view.scene.add(modelGroup);
    const meshGroup = new THREE.Group();
    const crackGroup = new THREE.Group();
    const grabProxy = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 3.25, 2.2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    modelGroup.add(meshGroup, crackGroup, grabProxy);
    addSoftShadowPlane(view.scene, -1.52, 2.35);
    const waxDipJar = new THREE.Group();
    const jarGlass = new THREE.MeshPhysicalMaterial({ color: '#d9f1f5', transparent: true, opacity: 0.26, roughness: 0.08, transmission: 0.55, thickness: 0.18, side: THREE.DoubleSide, depthWrite: false });
    const jarWax = new THREE.MeshPhysicalMaterial({ color: '#f0c46f', roughness: 0.24, clearcoat: 0.8, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
    const jarWall = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.16, 1.15, 48, 1, true), jarGlass);
    const jarBottom = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.08, 48), jarGlass);
    const jarRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.035, 12, 48), new THREE.MeshStandardMaterial({ color: '#bde9ef', roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.7 }));
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.96, 0.62, 48), jarWax);
    jarRim.rotation.x = Math.PI / 2;
    jarRim.position.y = 0.58;
    liquid.position.y = -0.18;
    jarBottom.position.y = -0.58;
    waxDipJar.add(jarWall, jarBottom, jarRim, liquid);
    waxDipJar.position.set(0, -1.72, 0.18);
    waxDipJar.visible = false;
    view.scene.add(waxDipJar);

    let body = null;
    let waxGroup = null;
    let waxCells = [];
    let geometry = null;
    let basePositions = null;
    let frontZ = 0.28;
    let shape = 'blob';
    let color = '#f5c75c';
    let dips = 0;
    let canSquish = false;
    let broken = false;
    let boing = 0;
    let pokes = [];
    let fragments = [];
    let clickHandler = () => {};
    let mode = 1;

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
      sheen: 0.65,
      sheenColor: new THREE.Color('#fff4c4'),
      envMapIntensity: 0.5
    });
    const waxMaterial = new THREE.MeshPhysicalMaterial({
      color: '#fff3d3',
      roughness: 0.19,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 0.85
    });
    const shardFaceMaterial = new THREE.MeshPhysicalMaterial({
      color: '#fff1cd',
      roughness: 0.17,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
      side: THREE.DoubleSide,
      envMapIntensity: 0.95
    });
    const shardSideMaterial = new THREE.MeshPhysicalMaterial({
      color: '#d9bc7d',
      roughness: 0.31,
      metalness: 0,
      clearcoat: 0.72,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
      envMapIntensity: 0.7
    });

    const buildWaxCells = () => {
      waxCells = [];
      waxGroup = new THREE.Group();
      waxGroup.scale.setScalar(1.018);
      waxGroup.renderOrder = 2;
      const position = geometry.attributes.position;
      const normal = geometry.attributes.normal;
      const sourceIndex = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, i) => i);
      const box = geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(position);
      const size = new THREE.Vector3();
      box.getSize(size);
      const buckets = new Map();
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();
      const center = new THREE.Vector3();
      for (let i = 0; i < sourceIndex.length; i += 3) {
        vA.fromBufferAttribute(position, sourceIndex[i]);
        vB.fromBufferAttribute(position, sourceIndex[i + 1]);
        vC.fromBufferAttribute(position, sourceIndex[i + 2]);
        center.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
        const ix = clamp(Math.floor(((center.x - box.min.x) / Math.max(0.001, size.x)) * 6), 0, 5);
        const iy = clamp(Math.floor(((center.y - box.min.y) / Math.max(0.001, size.y)) * 5), 0, 4);
        const iz = clamp(Math.floor(((center.z - box.min.z) / Math.max(0.001, size.z)) * 2), 0, 1);
        const key = ix + '-' + iy + '-' + iz;
        if (!buckets.has(key)) buckets.set(key, { indices: [], center: new THREE.Vector3(), count: 0 });
        const bucket = buckets.get(key);
        bucket.indices.push(sourceIndex[i], sourceIndex[i + 1], sourceIndex[i + 2]);
        bucket.center.add(center);
        bucket.count += 1;
      }
      buckets.forEach((bucket) => {
        bucket.center.multiplyScalar(1 / Math.max(1, bucket.count));
        const cellGeometry = new THREE.BufferGeometry();
        cellGeometry.setAttribute('position', position);
        cellGeometry.setAttribute('normal', normal);
        cellGeometry.setIndex(bucket.indices);
        cellGeometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(cellGeometry, waxMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        waxGroup.add(mesh);
        waxCells.push({ mesh, center: bucket.center.clone(), broken: false, stress: 0 });
      });
      meshGroup.add(waxGroup);
    };

    const rebuild = () => {
      while (meshGroup.children.length) meshGroup.remove(meshGroup.children[0]);
      if (geometry) geometry.dispose();
      geometry = makeShapeGeometry(shape);
      basePositions = Float32Array.from(geometry.attributes.position.array);
      frontZ = geometry.boundingBox ? geometry.boundingBox.max.z : 0.3;
      body = new THREE.Mesh(geometry, bodyMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      meshGroup.add(body);
      buildWaxCells();
      modelGroup.visible = true;
      broken = false;
    };

    const addCrack = (point) => {
      const material = new THREE.LineBasicMaterial({ color: '#6e5944', transparent: true, opacity: 0.72 });
      const branches = 5;
      for (let i = 0; i < branches; i += 1) {
        const angle = (i / branches) * Math.PI * 2 + Math.random() * 0.4;
        const length = 0.34 + Math.random() * 0.42;
        const points = [
          new THREE.Vector3(point.x, point.y, frontZ + 0.018),
          new THREE.Vector3(point.x + Math.cos(angle) * length, point.y + Math.sin(angle) * length, frontZ + 0.018)
        ];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        crackGroup.add(new THREE.Line(lineGeometry, material));
      }
    };

    const spawnFragments = () => {
      const palette = [new THREE.Color(color), new THREE.Color('#fff1c5'), new THREE.Color('#e0b46a')];
      for (let i = 0; i < 26; i += 1) {
        const radius = 0.08 + Math.random() * 0.18;
        const piece = new THREE.Mesh(
          new THREE.TetrahedronGeometry(radius, 0),
          new THREE.MeshPhysicalMaterial({ color: palette[i % palette.length], roughness: 0.25, clearcoat: 0.8 })
        );
        piece.position.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.35);
        piece.castShadow = true;
        view.scene.add(piece);
        fragments.push({
          mesh: piece,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 2.7, 1.2 + Math.random() * 2.6, (Math.random() - 0.5) * 1.3),
          spin: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4)
        });
      }
    };

    let rotationTargetX = 0;
    let rotationTargetY = 0;
    let GrabStress = 0;
    let chipCount = 0;
    let waxDamage = 0;
    let chipTrail = 0;
    let cellDetachedThisGesture = false;
    let grabHandle = null;
    let pointerInteraction = null;
    let statusHandler = () => {};
    let dipHandler = () => {};
    let dipTargetY = 0;
    let dipTriggered = false;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const grabPlane = new THREE.Plane();
    const scratchVector = new THREE.Vector3();
    const canvas = view.renderer.domElement;

    const pickBody = (event, includeGrabProxy = false) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, view.camera);
      if (!body) return null;
      const bodyHit = raycaster.intersectObject(body, false)[0];
      if (bodyHit) return bodyHit;
      if (includeGrabProxy && waxCells.some((cell) => !cell.broken)) {
        return raycaster.intersectObject(grabProxy, false)[0] || null;
      }
      return null;
    };

    const pointOnGrabPlane = (event, handle) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, view.camera);
      const hit = raycaster.ray.intersectPlane(handle.plane, scratchVector.clone());
      if (!hit) return null;
      return modelGroup.worldToLocal(hit.clone());
    };

    const addWaxFlakes = (point, count) => {
      for (let i = 0; i < count; i += 1) {
        const radius = 0.025 + Math.random() * 0.05;
        const material = new THREE.MeshPhysicalMaterial({
          color: '#fff0c8',
          roughness: 0.22,
          clearcoat: 1,
          transparent: true,
          opacity: 0.9
        });
        const piece = new THREE.Mesh(new THREE.TetrahedronGeometry(radius, 0), material);
        piece.position.copy(point);
        piece.castShadow = true;
        view.scene.add(piece);
        fragments.push({
          mesh: piece,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * 0.12),
          spin: new THREE.Vector3((Math.random() - 0.5) * 0.55, (Math.random() - 0.5) * 0.55, (Math.random() - 0.5) * 0.55),
          age: 0,
          life: 1.6 + Math.random() * 0.9,
          gravity: 1.0,
          materials: [material]
        });
      }
    };

    const makeThickShardGeometry = (sourceGeometry, thickness) => {
      const source = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
      const positions = source.attributes.position;
      const normals = source.attributes.normal;
      const facePositions = [];
      const sidePositions = [];
      const half = thickness * 0.5;
      const p0 = new THREE.Vector3();
      const p1 = new THREE.Vector3();
      const p2 = new THREE.Vector3();
      const n0 = new THREE.Vector3();
      const n1 = new THREE.Vector3();
      const n2 = new THREE.Vector3();
      const normal = new THREE.Vector3();
      for (let i = 0; i < positions.count; i += 3) {
        p0.fromBufferAttribute(positions, i);
        p1.fromBufferAttribute(positions, i + 1);
        p2.fromBufferAttribute(positions, i + 2);
        n0.fromBufferAttribute(normals, i);
        n1.fromBufferAttribute(normals, i + 1);
        n2.fromBufferAttribute(normals, i + 2);
        normal.copy(n0).add(n1).add(n2).normalize();
        const f0 = p0.clone().addScaledVector(normal, half);
        const f1 = p1.clone().addScaledVector(normal, half);
        const f2 = p2.clone().addScaledVector(normal, half);
        const b0 = p0.clone().addScaledVector(normal, -half);
        const b1 = p1.clone().addScaledVector(normal, -half);
        const b2 = p2.clone().addScaledVector(normal, -half);
        facePositions.push(f0.x,f0.y,f0.z, f1.x,f1.y,f1.z, f2.x,f2.y,f2.z);
        facePositions.push(b0.x,b0.y,b0.z, b2.x,b2.y,b2.z, b1.x,b1.y,b1.z);
        const edges = [[f0,f1,b1,b0],[f1,f2,b2,b1],[f2,f0,b0,b2]];
        edges.forEach((edge) => {
          sidePositions.push(
            edge[0].x,edge[0].y,edge[0].z,
            edge[1].x,edge[1].y,edge[1].z,
            edge[2].x,edge[2].y,edge[2].z,
            edge[0].x,edge[0].y,edge[0].z,
            edge[2].x,edge[2].y,edge[2].z,
            edge[3].x,edge[3].y,edge[3].z
          );
        });
      }
      source.dispose();
      const thick = new THREE.BufferGeometry();
      thick.setAttribute('position', new THREE.Float32BufferAttribute(facePositions.concat(sidePositions), 3));
      thick.computeVertexNormals();
      thick.addGroup(0, facePositions.length / 3, 0);
      thick.addGroup(facePositions.length / 3, sidePositions.length / 3, 1);
      return thick;
    };

    const spawnCellFragment = (cell, point) => {
      cell.mesh.updateWorldMatrix(true, false);
      const sourceGeometry = cell.mesh.geometry.toNonIndexed();
      sourceGeometry.applyMatrix4(cell.mesh.matrixWorld);
      const thickness = 0.035 + Math.min(0.035, waxMaterial.opacity * 0.07);
      const fragmentGeometry = makeThickShardGeometry(sourceGeometry, thickness);
      const faceMaterial = shardFaceMaterial.clone();
      const sideMaterial = shardSideMaterial.clone();
      faceMaterial.transparent = true;
      faceMaterial.opacity = 0.9;
      sideMaterial.transparent = true;
      sideMaterial.opacity = 1;
      const piece = new THREE.Mesh(fragmentGeometry, [faceMaterial, sideMaterial]);
      piece.castShadow = true;
      piece.receiveShadow = true;
      view.scene.add(piece);
      const direction = cell.center.clone().sub(point).normalize();
      fragments.push({
        mesh: piece,
        velocity: direction.multiplyScalar(0.12 + Math.random() * 0.13).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.12,
          -0.05 - Math.random() * 0.08,
          (Math.random() - 0.5) * 0.1
        )),
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5),
        age: 0,
        life: 3.6 + Math.random() * 1.2,
        gravity: 0.85,
        materials: [faceMaterial, sideMaterial]
      });
      cell.mesh.visible = false;
      waxGroup.remove(cell.mesh);
      cell.broken = true;
    };

    const applyCellStress = (point, amount) => {
      const candidates = waxCells
        .filter((cell) => !cell.broken)
        .sort((a, b) => a.center.distanceToSquared(point) - b.center.distanceToSquared(point));
      if (!candidates.length) {
        broken = true;
        statusHandler({ chips: chipCount, damage: waxDamage, broken: true, detached: false, stress: 0 });
        return { detached: false, broken: true };
      }
      const stressedNearby = candidates.find((item) => item.stress > 0.35 && item.center.distanceTo(point) < 1.0);
      const cell = stressedNearby || candidates[0];
      const falloff = clamp(1 - cell.center.distanceTo(point) / 1.35, 0.5, 1);
      cell.stress = clamp(cell.stress + amount * falloff * 0.2, 0, 1);
      pokes.push({ x: point.x, y: point.y, z: point.z, time: view.clock.elapsedTime, strength: 0.045 + amount * 0.1 });
      boing = Math.min(0.09, boing + 0.025);

      if (cell.stress < 1) {
        statusHandler({
          chips: chipCount,
          damage: waxDamage,
          broken: false,
          detached: false,
          stress: cell.stress
        });
        return { detached: false, broken: false };
      }

      spawnCellFragment(cell, point);
      cell.broken = true;
      cell.stress = 0;
      chipCount += 1;
      const brokenCells = waxCells.filter((item) => item.broken).length;
      waxDamage = waxCells.length ? brokenCells / waxCells.length : 1;

      waxCells.forEach((neighbor) => {
        if (neighbor === cell || neighbor.broken) return;
        const distance = neighbor.center.distanceTo(cell.center);
        if (distance < 0.72) neighbor.stress = clamp(neighbor.stress + 0.26 * (1 - distance / 0.72) * 0.2, 0, 0.92);
      });

      addWaxFlakes(point, 4);
      playImpact(250 + Math.min(chipCount, 20) * 22);
      if (brokenCells >= waxCells.length) {
        broken = true;
        grabHandle = null;
        addWaxFlakes(point, 12);
        statusHandler({ chips: chipCount, damage: waxDamage, broken: true, detached: true, stress: 0 });
      } else {
        statusHandler({ chips: chipCount, damage: waxDamage, broken: false, detached: true, stress: 0 });
      }
      return { detached: true, broken };
    };
    const playImpact = (frequency) => {
      if (typeof window.__playSquishyImpact === 'function') window.__playSquishyImpact(frequency);
    };

    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      audioStartUserGesture();
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      const hit = pickBody(event, mode === 3 && canSquish);
      if (hit && mode === 3 && !canSquish) {
        pointerInteraction = { type: 'dip', id: event.pointerId, startY: event.clientY, moved: false };
        dipTriggered = false;
        dipTargetY = 0;
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (hit && mode === 3 && canSquish) {
        const local = modelGroup.worldToLocal(hit.point.clone());
        const normal = view.camera.getWorldDirection(new THREE.Vector3()).negate();
        grabPlane.setFromNormalAndCoplanarPoint(normal, hit.point);
        grabHandle = {
          point: local,
          plane: grabPlane.clone(),
          offset: new THREE.Vector3(),
          targetOffset: new THREE.Vector3(),
          twist: 0,
          targetTwist: 0,
          active: true,
          clicked: true,
          lastX: event.clientX,
          lastY: event.clientY
        };
        pointerInteraction = {
          type: 'grab',
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false
        };
        chipTrail = 0;
        cellDetachedThisGesture = false;
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (hit && mode === 2) {
        pointerInteraction = {
          type: 'tap',
          id: event.pointerId,
          point: modelGroup.worldToLocal(hit.point.clone()),
          startX: event.clientX,
          startY: event.clientY,
          moved: false
        };
        return;
      }
      pointerInteraction = {
        type: 'rotate',
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false
      };
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!pointerInteraction || pointerInteraction.id !== event.pointerId) return;
      const dx = event.clientX - pointerInteraction.startX;
      const dy = event.clientY - pointerInteraction.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) pointerInteraction.moved = true;

      if (pointerInteraction.type === 'rotate') {
        const stepX = event.clientX - pointerInteraction.lastX;
        const stepY = event.clientY - pointerInteraction.lastY;
        rotationTargetY += stepX * 0.009;
        rotationTargetX = clamp(rotationTargetX + stepY * 0.007, -0.8, 0.8);
        pointerInteraction.lastX = event.clientX;
        pointerInteraction.lastY = event.clientY;
        return;
      }

      if (pointerInteraction.type === 'dip') {
        const progress = clamp((event.clientY - pointerInteraction.startY) / 150, 0, 1);
        const squishyStage = document.querySelector('.squishy-stage');
        if (squishyStage) squishyStage.style.setProperty('--squishy-dip-shift', (progress * 62).toFixed(2) + '%');
        dipTargetY = 0;
        if (progress >= 0.94 && !dipTriggered) {
          dipTriggered = true;
          dipHandler();
        } else if (progress <= 0.3 && dipTriggered) {
          dipTriggered = false;
        }
        return;
      }

      if (pointerInteraction.type === 'grab' && grabHandle) {
        const local = pointOnGrabPlane(event, grabHandle);
        if (!local) return;
        const delta = local.sub(grabHandle.point);
        delta.clampLength(0, 1.15);
        grabHandle.targetOffset.copy(delta).multiplyScalar(0.82);
        grabHandle.targetTwist = clamp(delta.x * 1.55 + delta.y * 0.65, -1.15, 1.15);
        const moveDistance = Math.hypot(event.clientX - grabHandle.lastX, event.clientY - grabHandle.lastY);
        grabHandle.lastX = event.clientX;
        grabHandle.lastY = event.clientY;
        chipTrail += moveDistance;
        GrabStress += moveDistance * 0.012;
        if (grabHandle.targetOffset.length() > 0.06) {
          const amount = Math.min(0.42, moveDistance * 0.018);
          if (amount > 0.004) applyCellStress(grabHandle.point.clone(), amount);
          chipTrail = 0;
          GrabStress = 0;
        }
      }
    });

    const endPointer = (event) => {
      if (!pointerInteraction || pointerInteraction.id !== event.pointerId) return;
      if (pointerInteraction.type === 'tap' && !pointerInteraction.moved) {
        clickHandler(pointerInteraction.point);
      }
      if (pointerInteraction.type === 'rotate' && !pointerInteraction.moved) {
        rotationTargetY += 0.1;
        rotationTargetX = clamp(rotationTargetX + 0.018, -0.8, 0.8);
      }
      if (pointerInteraction.type === 'dip') {
        dipTargetY = 0;
        dipTriggered = false;
        const squishyStage = document.querySelector('.squishy-stage');
        if (squishyStage) squishyStage.style.setProperty('--squishy-dip-shift', '0%');
      }
      if (pointerInteraction.type === 'grab' && grabHandle) {
        if (!pointerInteraction.moved) {
          applyCellStress(grabHandle.point.clone(), 1.0);
          grabHandle = null;
        } else {
          grabHandle.active = false;
          grabHandle.targetOffset.set(0, 0, 0);
          grabHandle.targetTwist = 0;
          statusHandler({ chips: chipCount, damage: waxDamage, broken, released: true });
        }
      }
      canvas.style.cursor = 'grab';
      pointerInteraction = null;
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    const applyDeformation = (delta) => {
      if (!geometry || (!grabHandle && !pokes.length)) return;
      if (grabHandle) {
        grabHandle.offset.lerp(grabHandle.targetOffset, Math.min(1, delta * 18));
        grabHandle.twist += (grabHandle.targetTwist - grabHandle.twist) * Math.min(1, delta * 16);
        if (!grabHandle.active) {
          grabHandle.offset.multiplyScalar(Math.exp(-delta * 5.5));
          grabHandle.twist *= Math.exp(-delta * 5.5);
          if (grabHandle.offset.lengthSq() < 0.00002 && Math.abs(grabHandle.twist) < 0.002) grabHandle = null;
        }
      }
      const positions = geometry.attributes.position;
      const now = view.clock.elapsedTime;
      pokes = pokes.filter((poke) => now - poke.time < 1.15);
      for (let i = 0; i < positions.count; i += 1) {
        const index = i * 3;
        let x = basePositions[index];
        let y = basePositions[index + 1];
        let z = basePositions[index + 2];
        if (grabHandle) {
          const rx = x - grabHandle.point.x;
          const ry = y - grabHandle.point.y;
          const rz = z - grabHandle.point.z;
          const distanceSq = rx * rx + ry * ry + rz * rz;
          const weight = Math.exp(-distanceSq / 1.15);
          const angle = grabHandle.twist * weight;
          const cs = Math.cos(angle);
          const sn = Math.sin(angle);
          const rx2 = rx * cs - rz * sn;
          const rz2 = rx * sn + rz * cs;
          const pull = grabHandle.offset.length();
          const pinch = Math.min(0.19, pull * 0.12) * weight;
          x = grabHandle.point.x + rx2 * (1 - pinch) + grabHandle.offset.x * weight;
          y = grabHandle.point.y + ry * (1 - pinch * 0.65) + grabHandle.offset.y * weight;
          z = grabHandle.point.z + rz2 * (1 - pinch) + grabHandle.offset.z * weight;
        }
        pokes.forEach((poke) => {
          const age = now - poke.time;
          if (age > 1.15) return;
          const dx = x - poke.x;
          const dy = y - poke.y;
          const dz = z - poke.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance < 0.75) {
            const falloff = Math.pow(1 - distance / 0.75, 2);
            const strength = poke.strength * Math.exp(-age * 2.8) * falloff;
            x -= Math.sign(x || 1) * strength;
            y -= Math.sign(y || 1) * strength;
            z -= Math.sign(z || 1) * strength;
          }
        });
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    const audioStartUserGesture = () => {
      if (typeof window.__audioStartUserGesture === 'function') window.__audioStartUserGesture();
    };

    view.setUpdate((delta, time) => {
      modelGroup.rotation.x += (rotationTargetX - modelGroup.rotation.x) * 0.1;
      modelGroup.rotation.y += (rotationTargetY - modelGroup.rotation.y) * 0.1;
      modelGroup.position.y += (dipTargetY - modelGroup.position.y) * Math.min(1, delta * 14);
      if (!broken) {
        applyDeformation(delta);
        boing = Math.max(0, boing - delta * 2.2);
        const squish = Math.sin(time * 2.3) * 0.007 + boing;
        modelGroup.scale.set(1 + squish * 0.7, 1 - squish, 1 + squish * 0.35);
      }
      for (let fragmentIndex = fragments.length - 1; fragmentIndex >= 0; fragmentIndex -= 1) {
        const fragment = fragments[fragmentIndex];
        fragment.age = (fragment.age || 0) + delta;
        fragment.velocity.y -= (fragment.gravity || 1.2) * delta;
        fragment.mesh.position.addScaledVector(fragment.velocity, delta);
        fragment.mesh.rotation.x += fragment.spin.x * delta;
        fragment.mesh.rotation.y += fragment.spin.y * delta;
        fragment.mesh.rotation.z += fragment.spin.z * delta;
        const fade = Math.max(0, 1 - fragment.age / (fragment.life || 1.2));
        const materials = Array.isArray(fragment.mesh.material) ? fragment.mesh.material : [fragment.mesh.material];
        materials.forEach((material) => {
          material.transparent = true;
          material.opacity = fade;
        });
        if (fragment.age >= (fragment.life || 1.2)) {
          view.scene.remove(fragment.mesh);
          fragment.mesh.geometry.dispose();
          materials.forEach((material) => material.dispose());
          fragments.splice(fragmentIndex, 1);
        }
      }
    });

    rebuild();
    waxGroup.visible = false;


    return {
      activate() { view.activate(); },
      deactivate() { view.deactivate(); },
      resize() { view.resize(); },
      setFrontView() {
        rotationTargetX = 0;
        rotationTargetY = 0;
        modelGroup.rotation.set(0, 0, 0);
      },
      setMode(value) {
        mode = value;
        waxDipJar.visible = false;
        if (mode !== 3) {
          grabHandle = null;
          pointerInteraction = null;
          dipTargetY = 0;
        }
      },
      setClickHandler(handler) { clickHandler = handler; },
      setDipHandler(handler) { dipHandler = handler; },
      setStatusHandler(handler) { statusHandler = handler; },
      setShape(value) { if (shape === value) return; shape = value; rebuild(); },
      setColor(value) { color = value; bodyMaterial.color.set(value); bodyMaterial.sheenColor.set(value); },
      setDips(value) {
        dips = value;
        const thickness = 1 + 0.115 * (1 - Math.exp(-value / 2.6));
        waxGroup.scale.setScalar(thickness);
        waxMaterial.opacity = 0.18 + 0.34 * (1 - Math.exp(-value / 2.2));
        waxGroup.visible = value > 0;
      },
      setCanSquish(value) {
        canSquish = value;
        waxDipJar.visible = false;
        if (value) {
          broken = false;
          chipCount = 0;
          waxDamage = 0;
          chipTrail = 0;
          GrabStress = 0;
          pokes = [];
        }
      },
      poke(point) {
        return applyCellStress(point.clone(), 0.72);
      },
      reset() {
        shape = 'blob';
        color = '#f5c75c';
        dips = 0;
        canSquish = false;
        broken = false;
        mode = 1;
        pokes = [];
        chipCount = 0;
        waxDamage = 0;
        chipTrail = 0;
        GrabStress = 0;
        grabHandle = null;
        pointerInteraction = null;
        rotationTargetX = 0;
        rotationTargetY = 0;
        dipTargetY = 0;
        dipTriggered = false;
        modelGroup.position.y = 0;
        waxDipJar.visible = false;
        crackGroup.clear();
        fragments.forEach((fragment) => {
          view.scene.remove(fragment.mesh);
          fragment.mesh.geometry.dispose();
          const materials = Array.isArray(fragment.mesh.material) ? fragment.mesh.material : [fragment.mesh.material];
          materials.filter(Boolean).forEach((material) => material.dispose());
        });
        fragments = [];
        bodyMaterial.color.set(color);
        bodyMaterial.sheenColor.set(color);
        waxMaterial.opacity = 0;
        rebuild();
        waxGroup.scale.setScalar(1.026);
        waxGroup.visible = false;
      }
    };
  };

  const createJelly3D = (mount) => {
    const view = createView(mount, { camera: [0, 0.7, 5.35], lookAt: [0, -0.08, 0], fov: 33, exposure: 1.2 });
    const world = new THREE.Group();
    view.scene.add(world);
    const modelGroup = new THREE.Group();
    world.add(modelGroup);
    addSoftShadowPlane(view.scene, -1.5, 2.25);

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.72, 1.82, 0.15, 64),
      new THREE.MeshPhysicalMaterial({ color: '#f6fcfd', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.15 })
    );
    plate.position.y = -1.34;
    plate.receiveShadow = true;
    world.add(plate);

    let mold = 'flower';
    let color = '#ffb5db';
    let geometry = null;
    let mesh = null;
    let basePositions = null;
    let clickHandler = () => {};
    let mode = 'hand';
    let eatCount = 0;
    let complete = false;
    let completeAt = -10;
    let wobbleStart = -10;
    let wobbleAmount = 0;
    let handGrab = null;
    let pointerInteraction = null;
    let rotationTargetX = -0.08;
    let rotationTargetY = 0.16;
    const scoopPieces = [];
    const rimGroup = new THREE.Group();
    modelGroup.add(rimGroup);

    const MAX_BITES = 52;
    const biteCenters = Array.from({ length: MAX_BITES }, () => new THREE.Vector3(9999, 9999, 9999));
    const biteRadii = new Float32Array(MAX_BITES);

    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.055,
      metalness: 0,
      transmission: 0.88,
      transparent: true,
      opacity: 0.84,
      thickness: 1.45,
      ior: 1.36,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      iridescence: 0.16,
      iridescenceIOR: 1.28,
      envMapIntensity: 1.25,
      attenuationColor: new THREE.Color('#ffe8f3'),
      attenuationDistance: 2.4,
      side: THREE.DoubleSide
    });

    material.onBeforeCompile = (shader) => {
      const nl = String.fromCharCode(10);
      shader.uniforms.uBiteCenters = { value: biteCenters };
      shader.uniforms.uBiteRadii = { value: biteRadii };
      const commonVertex = ['varying vec3 vJellyLocal;', shader.vertexShader].join(nl);
      shader.vertexShader = commonVertex.replace('#include <begin_vertex>', ['#include <begin_vertex>', 'vJellyLocal = position;'].join(nl));
      const commonFragment = [
        'varying vec3 vJellyLocal;',
        'uniform vec3 uBiteCenters[' + MAX_BITES + '];',
        'uniform float uBiteRadii[' + MAX_BITES + '];',
        shader.fragmentShader
      ].join(nl);
      const clip = [
        '#include <clipping_planes_fragment>',
        'for (int biteIndex = 0; biteIndex < ' + MAX_BITES + '; biteIndex++) {',
        '  if (uBiteRadii[biteIndex] > 0.001 && distance(vJellyLocal, uBiteCenters[biteIndex]) < uBiteRadii[biteIndex]) discard;',
        '}'
      ].join(nl);
      shader.fragmentShader = commonFragment.replace('#include <clipping_planes_fragment>', clip);
    };
    material.customProgramCacheKey = () => 'emotion-jelly-bites-v1';

    const makeInnerSparkles = () => {
      for (let i = 0; i < 10; i += 1) {
        const sparkle = new THREE.Mesh(
          new THREE.SphereGeometry(0.025 + Math.random() * 0.035, 10, 8),
          new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffffff' : '#fff1d8', transparent: true, opacity: 0.45 })
        );
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 0.74;
        sparkle.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 0.82, Math.sin(angle) * radius * 0.32);
        modelGroup.add(sparkle);
      }
    };

    const clearBiteHoles = () => {
      biteRadii.fill(0);
      biteCenters.forEach((center) => center.set(9999, 9999, 9999));
    };

    const rebuild = () => {
      while (modelGroup.children.length) modelGroup.remove(modelGroup.children[0]);
      if (geometry) geometry.dispose();
      geometry = makeShapeGeometry(mold);
      basePositions = Float32Array.from(geometry.attributes.position.array);
      mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      modelGroup.add(mesh, rimGroup);
      makeInnerSparkles();
      modelGroup.visible = true;
      modelGroup.scale.setScalar(1);
      eatCount = 0;
      complete = false;
      completeAt = -10;
      wobbleStart = -10;
      wobbleAmount = 0;
      handGrab = null;
      pointerInteraction = null;
      clearBiteHoles();
      while (rimGroup.children.length) rimGroup.remove(rimGroup.children[0]);
    };

    const spawnScoopPiece = (point, normal) => {
      const pieceMaterial = material.clone();
      pieceMaterial.transmission = 0.55;
      pieceMaterial.opacity = 0.82;
      const piece = new THREE.Mesh(new THREE.SphereGeometry(0.13 + Math.random() * 0.06, 18, 13), pieceMaterial);
      piece.position.copy(modelGroup.localToWorld(point.clone()).addScaledVector(normal, 0.05));
      piece.castShadow = true;
      view.scene.add(piece);
      scoopPieces.push({
        mesh: piece,
        age: 0,
        life: 0.86,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.16, 0.3 + Math.random() * 0.18, 0.08)
      });
    };

    const addBite = (point, normal) => {
      if (complete || eatCount >= MAX_BITES) return;
      const slot = biteRadii.findIndex((radius) => radius <= 0.001);
      if (slot < 0) return;
      const biteRadius = 0.36 + Math.random() * 0.05;
      biteCenters[slot].copy(point);
      biteRadii[slot] = biteRadius;
      const cavityColor = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.22);
      const cavityMaterial = new THREE.MeshPhysicalMaterial({
        color: cavityColor,
        roughness: 0.09,
        metalness: 0,
        transmission: 0.42,
        transparent: true,
        opacity: 0.78,
        thickness: 0.9,
        ior: 1.34,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        side: THREE.BackSide,
        depthWrite: false
      });
      const cavity = new THREE.Mesh(new THREE.SphereGeometry(biteRadius * 1.03, 32, 24), cavityMaterial);
      cavity.position.copy(point).addScaledVector(normal, -biteRadius * 0.82);
      cavity.renderOrder = 3;
      rimGroup.add(cavity);
      const lipMaterial = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, roughness: 0.06, clearcoat: 1, depthWrite: false });
      const lip = new THREE.Mesh(new THREE.TorusGeometry(biteRadius * 0.72, 0.015, 8, 32), lipMaterial);
      lip.position.copy(point).addScaledVector(normal, 0.006);
      lip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      rimGroup.add(lip);
      eatCount += 1;
      spawnScoopPiece(point, normal);
      wobbleAmount = 0.075;
      wobbleStart = view.clock.elapsedTime;
      if (eatCount >= MAX_BITES) {
        complete = true;
        completeAt = view.clock.elapsedTime;
      }
      clickHandler(point, normal, { bites: eatCount, complete });
    };

    const applyHandDeformation = (delta) => {
      if (!geometry || !basePositions || !handGrab) return;
      handGrab.offset.lerp(handGrab.targetOffset, Math.min(1, delta * 18));
      if (!handGrab.active) {
        handGrab.offset.multiplyScalar(Math.exp(-delta * 6));
        if (handGrab.offset.lengthSq() < 0.00002) handGrab = null;
      }
      if (!handGrab) return;
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        const index = i * 3;
        const x0 = basePositions[index];
        const y0 = basePositions[index + 1];
        const z0 = basePositions[index + 2];
        const dx = x0 - handGrab.point.x;
        const dy = y0 - handGrab.point.y;
        const dz = z0 - handGrab.point.z;
        const weight = Math.exp(-(dx * dx + dy * dy + dz * dz) / 1.05);
        const pull = handGrab.offset.length();
        positions.setXYZ(
          i,
          x0 + handGrab.offset.x * weight,
          y0 + handGrab.offset.y * weight - Math.min(0.12, pull * 0.025) * weight,
          z0 + handGrab.offset.z * weight
        );
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const scratch = new THREE.Vector3();
    const canvas = view.renderer.domElement;

    const pickJelly = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, view.camera);
      if (!mesh || complete) return null;
      return raycaster.intersectObject(mesh, false)[0] || null;
    };

    const pointOnPlane = (event, plane) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, view.camera);
      const hit = raycaster.ray.intersectPlane(plane, scratch.clone());
      return hit ? modelGroup.worldToLocal(hit.clone()) : null;
    };

    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const hit = pickJelly(event);
      if (hit && mode === 'hand') {
        const local = modelGroup.worldToLocal(hit.point.clone());
        const normal = view.camera.getWorldDirection(new THREE.Vector3()).negate();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
        handGrab = {
          point: local,
          plane,
          offset: new THREE.Vector3(),
          targetOffset: new THREE.Vector3(),
          active: true
        };
        pointerInteraction = { type: 'hand', id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (hit && mode === 'spoon') {
        const local = modelGroup.worldToLocal(hit.point.clone());
        const normal = hit.face ? hit.face.normal.clone().normalize() : local.clone().normalize();
        pointerInteraction = { type: 'spoon', id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, point: local, normal };
        return;
      }
      pointerInteraction = { type: 'rotate', id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!pointerInteraction || pointerInteraction.id !== event.pointerId) return;
      const dx = event.clientX - pointerInteraction.startX;
      const dy = event.clientY - pointerInteraction.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) pointerInteraction.moved = true;
      if (pointerInteraction.type === 'rotate') {
        const stepX = event.clientX - pointerInteraction.lastX;
        const stepY = event.clientY - pointerInteraction.lastY;
        rotationTargetY += stepX * 0.009;
        rotationTargetX = clamp(rotationTargetX + stepY * 0.007, -0.8, 0.8);
        pointerInteraction.lastX = event.clientX;
        pointerInteraction.lastY = event.clientY;
      } else if (pointerInteraction.type === 'hand' && handGrab) {
        const local = pointOnPlane(event, handGrab.plane);
        if (!local) return;
        const offset = local.sub(handGrab.point).clampLength(0, 0.95);
        handGrab.targetOffset.copy(offset);
      }
    });

    const endPointer = (event) => {
      if (!pointerInteraction || pointerInteraction.id !== event.pointerId) return;
      if (pointerInteraction.type === 'hand' && handGrab) {
        if (!pointerInteraction.moved) {
          wobbleAmount = 0.18;
          wobbleStart = view.clock.elapsedTime;
          clickHandler(handGrab.point.clone(), null, { hand: true, bites: 0, complete: false });
        } else {
          clickHandler(handGrab.point.clone(), null, { hand: true, bites: 0, complete: false, pulled: true });
        }
        handGrab.active = false;
        handGrab.targetOffset.set(0, 0, 0);
      }
      if (pointerInteraction.type === 'spoon' && !pointerInteraction.moved) {
        addBite(pointerInteraction.point, pointerInteraction.normal);
      }
      if (pointerInteraction.type === 'rotate' && !pointerInteraction.moved) {
        rotationTargetY += 0.1;
      }
      pointerInteraction = null;
      canvas.style.cursor = mode === 'spoon' ? 'pointer' : 'grab';
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    view.setUpdate((delta, time) => {
      world.rotation.x += (rotationTargetX - world.rotation.x) * 0.1;
      world.rotation.y += (rotationTargetY - world.rotation.y) * 0.1;
      applyHandDeformation(delta);
      const wobbleAge = time - wobbleStart;
      const wobble = wobbleAge < 1.45 ? Math.sin(wobbleAge * 18) * Math.exp(-wobbleAge * 3.1) * wobbleAmount : 0;
      const completionAge = time - completeAt;
      const completionScale = complete ? Math.max(0.03, 1 - completionAge * 1.8) : 1;
      modelGroup.scale.set((1 - wobble * 0.72) * completionScale, (1 + wobble * 1.18) * completionScale, (1 - wobble * 0.36) * completionScale);
      modelGroup.position.y = -0.08 + Math.sin(time * 1.6) * 0.025;
      if (complete && completionAge > 0.55) mesh.visible = false;
      for (let i = scoopPieces.length - 1; i >= 0; i -= 1) {
        const piece = scoopPieces[i];
        piece.age += delta;
        piece.mesh.position.addScaledVector(piece.velocity, delta);
        piece.mesh.rotation.x += delta * 2;
        const fade = Math.max(0, 1 - piece.age / piece.life);
        piece.mesh.material.opacity = fade * 0.82;
        piece.mesh.scale.setScalar(0.8 + fade * 0.25);
        if (piece.age >= piece.life) {
          view.scene.remove(piece.mesh);
          piece.mesh.geometry.dispose();
          piece.mesh.material.dispose();
          scoopPieces.splice(i, 1);
        }
      }
    });

    rebuild();

    return {
      activate() { view.activate(); },
      deactivate() { view.deactivate(); },
      resize() { view.resize(); },
      setClickHandler(handler) { clickHandler = handler; },
      setMode(value) {
        mode = value;
        handGrab = null;
        pointerInteraction = null;
        canvas.style.cursor = value === 'spoon' ? 'pointer' : 'grab';
      },
      setMold(value) { if (mold === value) return; mold = value; rebuild(); },
      setColor(value) {
        color = value;
        material.color.set(value);
        material.attenuationColor.set(value).lerp(new THREE.Color('#ffffff'), 0.58);
      },
      squish() {
        wobbleAmount = 0.18;
        wobbleStart = view.clock.elapsedTime;
      },
      finish() {
        if (complete) return;
        complete = true;
        completeAt = view.clock.elapsedTime;
      },
      reset() {
        mold = 'flower';
        color = '#ffb5db';
        material.color.set(color);
        material.attenuationColor.set(color).lerp(new THREE.Color('#ffffff'), 0.58);
        mode = 'hand';
        scoopPieces.forEach((piece) => {
          view.scene.remove(piece.mesh);
          piece.mesh.geometry.dispose();
          piece.mesh.material.dispose();
        });
        scoopPieces.length = 0;
        rebuild();
      }
    };
  };

  const makeCookingRecipe = (recipe, world) => {
    const group = new THREE.Group();
    const mat = (color, roughness = 0.4) => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.35, clearcoatRoughness: 0.38 });
    const addMesh = (geometry, material, position, rotation) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      if (rotation) mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    if (recipe === 'cake') {
      addMesh(new THREE.CylinderGeometry(1.08, 1.08, 0.48, 48), mat('#f2bd8a'), [0, -0.3, 0]);
      addMesh(new THREE.CylinderGeometry(1.02, 1.02, 0.26, 48), mat('#fff4de'), [0, 0.03, 0]);
      addMesh(new THREE.CylinderGeometry(0.95, 0.95, 0.46, 48), mat('#e8a77b'), [0, 0.38, 0]);
      addMesh(new THREE.TorusGeometry(0.76, 0.1, 16, 48), mat('#fff4e8'), [0, 0.62, 0], [Math.PI / 2, 0, 0]);
      addMesh(new THREE.SphereGeometry(0.13, 20, 16), mat('#df4965'), [0.28, 0.74, 0.08]);
      addMesh(new THREE.SphereGeometry(0.11, 20, 16), mat('#8f5db5'), [-0.22, 0.73, 0.2]);
    } else if (recipe === 'drink') {
      addMesh(new THREE.CylinderGeometry(0.68, 0.55, 1.75, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: '#d9f4ff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0, clearcoat: 1, transmission: 0.5, side: THREE.DoubleSide }), [0, 0.07, 0]);
      addMesh(new THREE.CylinderGeometry(0.59, 0.48, 1.18, 40), new THREE.MeshPhysicalMaterial({ color: '#f3a0bb', transparent: true, opacity: 0.75, roughness: 0.12, clearcoat: 1 }), [0, -0.2, 0]);
      addMesh(new THREE.CylinderGeometry(0.045, 0.045, 1.55, 16), mat('#f5d26d', 0.2), [0.22, 0.42, 0.05], [0, 0, -0.14]);
      addMesh(new THREE.TorusGeometry(0.24, 0.055, 12, 28), mat('#f3d06a', 0.25), [-0.35, 0.92, 0], [Math.PI / 2, 0, 0]);
    } else if (recipe === 'waffle') {
      addMesh(new THREE.BoxGeometry(2.12, 0.3, 2.12), mat('#d49b4f', 0.55), [0, -0.34, 0]);
      for (let i = -2; i <= 2; i += 1) {
        addMesh(new THREE.BoxGeometry(1.8, 0.035, 0.07), mat('#f1c37b', 0.45), [0, -0.17, i * 0.36]);
        addMesh(new THREE.BoxGeometry(0.07, 0.035, 1.8), mat('#f1c37b', 0.45), [i * 0.36, -0.17, 0]);
      }
      addMesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), mat('#fff2b8'), [0.22, -0.05, 0.1], [0, -0.12, 0]);
      addMesh(new THREE.SphereGeometry(0.14, 20, 16), mat('#da526b'), [-0.46, -0.06, -0.1]);
    } else {
      addMesh(new THREE.CylinderGeometry(1.1, 1.08, 0.2, 48), mat('#d9a256'), [0, -0.33, 0]);
      addMesh(new THREE.CylinderGeometry(1.01, 1.04, 0.2, 48), mat('#e6b76e'), [0, -0.08, 0]);
      addMesh(new THREE.CylinderGeometry(0.91, 0.97, 0.2, 48), mat('#f2c880'), [0, 0.17, 0]);
      addMesh(new THREE.BoxGeometry(0.48, 0.16, 0.42), mat('#fff2b5'), [0.1, 0.36, 0.02], [0, 0.18, 0]);
      addMesh(new THREE.SphereGeometry(0.13, 20, 16), mat('#d94d6a'), [-0.34, 0.36, 0.12]);
    }
    group.position.y = 0.18;
    group.visible = false;
    world.add(group);
    return group;
  };

  const createCooking3D = (mount) => {
    const view = createView(mount, { camera: [0, 1.35, 5.5], lookAt: [0, 0.1, 0], fov: 34, exposure: 1.08 });
    const world = new THREE.Group();
    view.scene.add(world);
    addSoftShadowPlane(view.scene, -1.28, 2.55);
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.85, 0.16, 64),
      new THREE.MeshPhysicalMaterial({ color: '#f8fcfd', roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.22 })
    );
    plate.position.y = -1.08;
    plate.receiveShadow = true;
    world.add(plate);
    let recipe = 'pancake';
    let dishGroup = makeCookingRecipe(recipe, world);
    let ingredientObjects = [];
    let garnishGroup = new THREE.Group();
    world.add(garnishGroup);
    let clickHandler = () => {};
    let completeStart = -10;

    const rebuild = () => {
      if (dishGroup) world.remove(dishGroup);
      dishGroup = makeCookingRecipe(recipe, world);
    };

    const addIngredient = (index) => {
      const palette = ['#f4cf75', '#fff0d0', '#e28d76', '#96c89e', '#c68cdd'];
      const geometry = index % 2 === 0 ? new THREE.SphereGeometry(0.12, 18, 12) : new THREE.BoxGeometry(0.16, 0.16, 0.16);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: palette[index % palette.length], roughness: 0.35, clearcoat: 0.4 }));
      mesh.position.set(-2.1 + index * 0.45, 2.15, 0.8);
      mesh.castShadow = true;
      view.scene.add(mesh);
      ingredientObjects.push({ mesh, target: new THREE.Vector3(0, 0.1, 0), time: 0 });
    };

    const addGarnish = (point, symbol) => {
      const mesh = symbol === '♡'
        ? new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#e45e79', roughness: 0.25 }))
        : new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshPhysicalMaterial({ color: symbol === '✿' ? '#fff4dc' : '#f4c84f', roughness: 0.25 }));
      mesh.position.copy(point);
      garnishGroup.add(mesh);
    };

    const orbit = setupOrbitPointer(view, {
      group: world,
      getIntersectables: () => (dishGroup && dishGroup.visible ? dishGroup.children : []),
      onClick: (point) => clickHandler(point)
    });

    view.setUpdate((delta, time) => {
      orbit.update();
      ingredientObjects.forEach((item) => {
        item.time += delta;
        const targetY = item.target.y + 0.55;
        item.mesh.position.lerp(new THREE.Vector3(0, targetY, 0), Math.min(1, delta * 4.8));
        item.mesh.rotation.x += delta * 4;
        item.mesh.rotation.z += delta * 3;
        item.mesh.position.y += Math.sin(item.time * 9) * 0.004;
      });
      const completeAge = time - completeStart;
      if (completeAge >= 0 && completeAge < 1) {
        const scale = 1 + Math.sin(completeAge * Math.PI) * 0.12;
        dishGroup.scale.setScalar(scale);
      } else {
        dishGroup.scale.setScalar(1);
      }
      if (dishGroup.visible) dishGroup.rotation.y = Math.sin(time * 0.45) * 0.06;
    });

    return {
      activate() { view.activate(); },
      deactivate() { view.deactivate(); },
      resize() { view.resize(); },
      setClickHandler(handler) { clickHandler = handler; },
      setRecipe(value) { recipe = value; rebuild(); },
      addIngredient,
      complete() {
        dishGroup.visible = true;
        completeStart = view.clock.elapsedTime;
        ingredientObjects.forEach((item) => {
          view.scene.remove(item.mesh);
          item.mesh.geometry.dispose();
          item.mesh.material.dispose();
        });
        ingredientObjects = [];
      },
      addGarnish,
      feed() {
        completeStart = view.clock.elapsedTime;
        for (let i = 0; i < 12; i += 1) {
          const star = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.07 + Math.random() * 0.05, 0),
            new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd85f' : '#ffffff', transparent: true, opacity: 0.9 })
          );
          star.position.set((Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8);
          garnishGroup.add(star);
        }
      },
      reset() {
        while (garnishGroup.children.length) garnishGroup.remove(garnishGroup.children[0]);
        ingredientObjects.forEach((item) => view.scene.remove(item.mesh));
        ingredientObjects = [];
        recipe = 'pancake';
        rebuild();
      }
    };
  };

  const createSand3D = (mount) => {
    const view = createView(mount, {
      camera: [0, 0.18, 7.6],
      lookAt: [0, 0, 0],
      fov: 33,
      exposure: 1.08,
      hemiSky: '#fff9eb',
      hemiGround: '#b9d5e8',
      rimColor: '#f5d9ae'
    });
    const group = new THREE.Group();
    view.scene.add(group);

    const sandNeckY = 0.055;
    const sandTopY = 1.84;
    const sandBottomY = -1.84;
    const sandOuterRadius = 1.3;
    const sandNeckRadius = 0.075;
    let duration = 60;
    let running = false;
    let progress = 0;
    let upperSurfaceY = sandTopY;

    const radiusAtY = (y, bottomY, topY, bottomRadius, topRadius) => {
      const t = clamp((y - bottomY) / (topY - bottomY), 0, 1);
      return bottomRadius + (topRadius - bottomRadius) * t;
    };

    const coneVolumeFraction = (t, startRadius, endRadius) => {
      const radius = startRadius + (endRadius - startRadius) * t;
      const total = startRadius * startRadius + startRadius * endRadius + endRadius * endRadius;
      return t * (startRadius * startRadius + startRadius * radius + radius * radius) / total;
    };

    const solveConeFraction = (target, startRadius, endRadius) => {
      let low = 0;
      let high = 1;
      for (let i = 0; i < 16; i += 1) {
        const middle = (low + high) * 0.5;
        if (coneVolumeFraction(middle, startRadius, endRadius) < target) low = middle;
        else high = middle;
      }
      return (low + high) * 0.5;
    };

    const makeClippedSandMaterial = (color) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        metalness: 0.015,
        side: THREE.DoubleSide
      });
      material.userData.surfaceY = sandNeckY;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uSandSurfaceY = { value: material.userData.surfaceY };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vSandSurfaceLocalY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandSurfaceLocalY = position.y;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uSandSurfaceY;\nvarying float vSandSurfaceLocalY;')
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vSandSurfaceLocalY > uSandSurfaceY + 0.003) discard;');
        material.userData.shader = shader;
      };
      return material;
    };

    const setSandSurface = (material, surfaceY) => {
      material.userData.surfaceY = surfaceY;
      if (material.userData.shader) material.userData.shader.uniforms.uSandSurfaceY.value = surfaceY;
    };

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: '#f3fbff',
      transparent: true,
      opacity: 0.18,
      roughness: 0.035,
      metalness: 0,
      transmission: 0.72,
      thickness: 0.18,
      clearcoat: 1,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: '#c7a86b',
      roughness: 0.3,
      metalness: 0.38,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22
    });
    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: '#c8a76f',
      roughness: 0.88,
      metalness: 0.01,
      side: THREE.DoubleSide
    });
    const topSandMaterial = makeClippedSandMaterial('#c9a870');
    const bottomSandMaterial = makeClippedSandMaterial('#c09d64');

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 0.075, 1.86, 64, 1, true), glassMaterial);
    upper.position.y = 0.985;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 1.42, 1.86, 64, 1, true), glassMaterial);
    lower.position.y = -0.985;
    const glassLid = new THREE.Mesh(new THREE.CylinderGeometry(1.43, 1.43, 0.06, 64), glassMaterial);
    glassLid.position.y = 1.925;
    const glassBase = glassLid.clone();
    glassBase.position.y = -1.925;
    group.add(upper, lower, glassLid, glassBase);

    const upperSandGeometry = new THREE.CylinderGeometry(sandOuterRadius, sandNeckRadius, sandTopY - sandNeckY, 64, 1, false);
    upperSandGeometry.translate(0, (sandTopY + sandNeckY) * 0.5, 0);
    const lowerSandGeometry = new THREE.CylinderGeometry(sandNeckRadius, sandOuterRadius, sandNeckY - sandBottomY, 64, 1, false);
    lowerSandGeometry.translate(0, (sandNeckY + sandBottomY) * 0.5, 0);
    const upperSand = new THREE.Mesh(upperSandGeometry, topSandMaterial);
    const lowerSand = new THREE.Mesh(lowerSandGeometry, bottomSandMaterial);
    upperSand.castShadow = true;
    lowerSand.castShadow = true;
    group.add(upperSand, lowerSand);

    const upperFunnel = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 64, 5, true), surfaceMaterial);
    const lowerMound = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), surfaceMaterial);
    group.add(upperFunnel, lowerMound);

    const topRing = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.062, 18, 64), frameMaterial);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 1.965;
    const bottomRing = topRing.clone();
    bottomRing.position.y = -1.965;
    const waistRing = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.026, 14, 48), frameMaterial);
    waistRing.rotation.x = Math.PI / 2;
    group.add(topRing, bottomRing, waistRing);
    for (let i = 0; i < 4; i += 1) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 3.9, 14), frameMaterial);
      const angle = i * Math.PI / 2;
      post.position.set(Math.cos(angle) * 1.56, 0, Math.sin(angle) * 1.56);
      group.add(post);
    }

    const count = 520;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    let lowerSurfaceY = sandBottomY + 0.035;
    const streamTopY = sandNeckY - 0.018;

    const placeStreamGrain = (index, scatterAlongStream) => {
      const bottom = lowerSurfaceY + 0.012;
      const y = scatterAlongStream
        ? bottom + Math.random() * Math.max(0.01, streamTopY - bottom)
        : streamTopY - Math.random() * 0.035;
      const innerRadius = radiusAtY(y, sandBottomY, sandNeckY, sandOuterRadius, sandNeckRadius);
      const radialLimit = Math.max(0.008, Math.min(0.115, innerRadius * 0.28 - 0.008));
      const radius = Math.sqrt(Math.random()) * radialLimit;
      const angle = Math.random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
      speeds[index] = 0.82 + Math.random() * 0.86;
      phases[index] = Math.random() * Math.PI * 2;
    };

    for (let i = 0; i < count; i += 1) placeStreamGrain(i, true);
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const particleMaterial = new THREE.PointsMaterial({
      color: '#e4c591',
      size: 0.038,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    particles.visible = false;
    group.add(particles);

    addSoftShadowPlane(view.scene, -2.08, 2.12);

    const updateSandShape = () => {
      const upperVolume = 1 - progress;
      const upperT = solveConeFraction(upperVolume, sandNeckRadius, sandOuterRadius);
      upperSurfaceY = sandNeckY + (sandTopY - sandNeckY) * upperT;
      const lowerT = solveConeFraction(progress, sandOuterRadius, sandNeckRadius);
      lowerSurfaceY = sandNeckY + (sandBottomY - sandNeckY) * (1 - lowerT);

      setSandSurface(topSandMaterial, upperSurfaceY);
      setSandSurface(bottomSandMaterial, lowerSurfaceY);
      upperSand.visible = progress < 0.999 && upperSurfaceY > sandNeckY + 0.006;

      const upperRadius = radiusAtY(upperSurfaceY, sandNeckY, sandTopY, sandNeckRadius, sandOuterRadius);
      upperFunnel.visible = upperSand.visible && upperRadius > 0.018;
      const funnelDepth = Math.min(0.14, 0.06 + upperRadius * 0.06);
      upperFunnel.scale.set(Math.max(0.001, upperRadius), -funnelDepth, Math.max(0.001, upperRadius));
      upperFunnel.position.y = upperSurfaceY - funnelDepth * 0.5;

      const lowerRadius = radiusAtY(lowerSurfaceY, sandBottomY, sandNeckY, sandOuterRadius, sandNeckRadius);
      lowerMound.visible = lowerRadius > 0.035;
      lowerMound.scale.set(Math.max(0.001, lowerRadius * 0.98), 0.035 + progress * 0.16, Math.max(0.001, lowerRadius * 0.98));
      lowerMound.position.y = lowerSurfaceY - 0.002;
    };

    const orbit = setupOrbitPointer(view, {
      group,
      getIntersectables: () => [],
      onClick: () => {}
    });

    view.setUpdate((delta, time) => {
      orbit.update();
      group.rotation.z = Math.sin(time * 0.22) * 0.008;
      if (running && progress < 1) {
        progress = Math.min(1, progress + delta / Math.max(1, duration));
        if (progress >= 1) running = false;
      }
      updateSandShape();

      particles.visible = (running || (progress > 0 && progress < 1)) && progress < 0.999;
      if (particles.visible && running) {
        const attr = particleGeometry.attributes.position;
        const pace = clamp(1.45 - duration / 900, 0.62, 1.3);
        for (let i = 0; i < count; i += 1) {
          let x = attr.getX(i);
          let y = attr.getY(i);
          let z = attr.getZ(i);
          y -= speeds[i] * pace * delta;
          const innerRadius = radiusAtY(y, sandBottomY, sandNeckY, sandOuterRadius, sandNeckRadius);
          const radialLimit = Math.max(0.008, Math.min(0.12, innerRadius * 0.3 - 0.009));
          x += Math.sin(time * 3.2 + phases[i]) * 0.0008;
          z += Math.cos(time * 2.7 + phases[i] * 0.8) * 0.0008;
          const radius = Math.hypot(x, z);
          if (radius > radialLimit) {
            x *= radialLimit / Math.max(radius, 0.0001);
            z *= radialLimit / Math.max(radius, 0.0001);
          }
          if (y < lowerSurfaceY + 0.012) {
            placeStreamGrain(i, false);
            x = positions[i * 3];
            y = positions[i * 3 + 1];
            z = positions[i * 3 + 2];
          }
          attr.setXYZ(i, x, y, z);
        }
        attr.needsUpdate = true;
      }
      particleMaterial.opacity += ((running ? 0.88 : 0.42) - particleMaterial.opacity) * 0.16;
    });

    updateSandShape();

    const controller = {
      activate() { view.activate(); },
      deactivate() { view.deactivate(); },
      resize() { view.resize(); },
      setRunning(value) { running = Boolean(value) && progress < 1; },
      setDuration(value) { duration = clamp(Number(value) || 60, 60, 600); },
      reset() {
        progress = 0;
        running = false;
        lowerSurfaceY = sandBottomY + 0.035;
        updateSandShape();
        const attr = particleGeometry.attributes.position;
        for (let i = 0; i < count; i += 1) placeStreamGrain(i, true);
        for (let i = 0; i < count; i += 1) attr.setXYZ(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        attr.needsUpdate = true;
        particles.visible = false;
        particleMaterial.opacity = 0.42;
      }
    };
    return controller;
  };

  window.Game3D = {
    createSquishy3D,
    createJelly3D,
    createCooking3D,
    createSand3D
  };
})();
