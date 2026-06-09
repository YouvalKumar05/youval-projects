import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/* ── GLSL ─────────────────────────────────────────────────────────────────
   Dual-texture shader:
     uMRI  – greyscale MRI image (0-1 luminance)
     uMask – tumor mask RGBA (alpha channel > 0 = tumor pixel)

   Pipeline per-pixel:
     1. Compute MRI luminance.
     2. Discard near-black background (empty outer region vanishes).
     3. If this pixel falls inside the mask  →  dark-red tumor color.
     4. Otherwise  →  greyscale brain tissue with a faint blue clinical tint.
*/
const vertShader = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const fragShader = /* glsl */`
  uniform sampler2D uMRI;
  uniform sampler2D uMask;
  uniform float     uThresh;   // background luminance cutoff
  uniform float     uOpacity;
  uniform bool      uHasMask;

  varying vec2 vUv;

  void main(){
    float gray = dot(texture2D(uMRI, vUv).rgb, vec3(0.299,0.587,0.114));

    /* --- strip outer black background --- */
    if(gray < uThresh) discard;

    float maskVal = uHasMask ? texture2D(uMask, vUv).a : 0.0;

    vec3  col;
    float a;

    if(maskVal > 0.28){
      /* Tumor pixel — dark crimson → bright red gradient driven by MRI intensity */
      col = mix(vec3(0.38,0.00,0.00), vec3(0.95,0.10,0.10), gray);
      a   = uOpacity;
    } else {
      /* Normal brain — near-greyscale with very slight cool tint so it reads clinical */
      float b = gray * 1.02;                          // tiny blue boost
      col = vec3(gray * 0.84, gray * 0.88, min(b, 1.0));
      a   = smoothstep(uThresh, uThresh+0.07, gray) * uOpacity;
    }

    gl_FragColor = vec4(col, a);
  }
`;

export default function Brain3DViewer({ backendUrl, slices }) {
  const mountRef = useRef(null);
  const rendRef  = useRef(null);
  const frameRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const ringRef  = useRef(null);
  const camRef   = useRef(null);

  const st = useRef({
    dragging:false, rightDrag:false,
    last:{x:0,y:0},
    theta:-0.45, phi:0.92, radius:5.6,
    panX:0, panY:0, autoRot:true,
  });

  const [loaded, setLoaded] = useState(0);
  const [total,  setTotal]  = useState(0);
  const [ready,  setReady]  = useState(false);

  const moveCam = useCallback(() => {
    const s = st.current, c = camRef.current; if(!c) return;
    c.position.set(
      s.panX + s.radius * Math.sin(s.phi) * Math.sin(s.theta),
      s.panY + s.radius * Math.cos(s.phi),
               s.radius * Math.sin(s.phi) * Math.cos(s.theta),
    );
    c.lookAt(s.panX, s.panY, 0);
  }, []);

  useEffect(()=>{
    if(!slices || slices.length === 0) return;
    const el = mountRef.current;
    const W = el.clientWidth || 520, H = el.clientHeight || 460;

    /* ── Scene ────────────────────────────────────────────────── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010408);
    scene.fog = new THREE.FogExp2(0x010408, 0.042);

    /* ── Camera ───────────────────────────────────────────────── */
    const camera = new THREE.PerspectiveCamera(36, W/H, 0.01, 200);
    camRef.current = camera; moveCam();

    /* ── Renderer ─────────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.sortObjects = true;
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    /* ── Minimal lighting (mostly for the shell overlay) ─────── */
    scene.add(new THREE.AmbientLight(0x334455, 1.0));

    /* ── Stars ────────────────────────────────────────────────── */
    {
      const pos = new Float32Array(450*3);
      for(let i=0;i<450;i++){
        pos[i*3]=(Math.random()-.5)*26;
        pos[i*3+1]=(Math.random()-.5)*26;
        pos[i*3+2]=(Math.random()-.5)*26;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos,3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:0x557799,size:0.07,transparent:true,opacity:0.6})));
    }

    /* ── Brain silhouette shell ───────────────────────────────── */
    // Gently deformed sphere so the outline looks organic / brain-shaped
    const shellGeo = new THREE.SphereGeometry(1.78, 48, 48);
    {
      const p = shellGeo.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        const r=Math.sqrt(x*x+y*y+z*z);
        const nx=x/r,ny=y/r,nz=z/r;
        const d=1+Math.sin(nx*5)*Math.cos(ny*6)*0.03+Math.sin(ny*8+1)*Math.cos(nz*5)*0.02;
        p.setXYZ(i,nx*1.78*d,ny*1.78*d,nz*1.78*d);
      }
      shellGeo.computeVertexNormals();
    }
    scene.add(new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
      color:0x8899aa, wireframe:true, transparent:true, opacity:0.07,
    })));
    scene.add(new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
      color:0x223344, transparent:true, opacity:0.04, side:THREE.BackSide, depthWrite:false,
    })));

    /* ── Grid floor ───────────────────────────────────────────── */
    const grid = new THREE.GridHelper(6, 24, 0x060f18, 0x060f18);
    grid.position.y = -2.0; scene.add(grid);

    /* ── Slice planes ─────────────────────────────────────────── */
    // Pack 50 slices into 3.2 units — tighter stack than before
    const MAX   = 50;
    const DEPTH = 3.2;   // total Y span — tighter = slices closer together
    const SIZE  = 2.55;  // plane size
    const THRESH = 0.036; // background cutoff

    const step   = Math.max(1, Math.floor(slices.length / MAX));
    const chosen = slices.filter((_,i) => i % step === 0).slice(0, MAX);
    setTotal(chosen.length);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    let cnt = 0;
    const done = () => { cnt++; setLoaded(cnt); if(cnt === chosen.length) setReady(true); };

    chosen.forEach((slice, idx) => {
      const y   = -DEPTH/2 + (idx / Math.max(chosen.length-1,1)) * DEPTH;
      const mriUrl  = `${backendUrl}/api/image?path=${encodeURIComponent(slice.image_path)}`;
      const maskUrl = slice.mask_path
        ? `${backendUrl}/api/mask?path=${encodeURIComponent(slice.mask_path)}`
        : null;

      // Load MRI image first
      loader.load(mriUrl, (mriTex) => {
        mriTex.minFilter = THREE.LinearFilter;
        mriTex.magFilter = THREE.LinearFilter;

        const buildMesh = (maskTex) => {
          const hasMask = !!maskTex && !!slice.mask_path;

          const mat = new THREE.ShaderMaterial({
            uniforms: {
              uMRI:     { value: mriTex },
              uMask:    { value: maskTex || mriTex }, // dummy if no mask
              uThresh:  { value: THRESH },
              uOpacity: { value: slice.has_tumor ? 0.85 : 0.70 },
              uHasMask: { value: hasMask },
            },
            vertexShader:   vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite:  false,
            side: THREE.DoubleSide,
          });

          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), mat);
          mesh.rotation.x  = Math.PI / 2;
          mesh.position.y  = y;
          mesh.renderOrder = idx;
          scene.add(mesh);
          done();
        };

        // Load mask texture if this slice has a mask
        if (maskUrl && slice.has_tumor) {
          loader.load(maskUrl, (maskTex) => {
            maskTex.minFilter = THREE.LinearFilter;
            maskTex.magFilter = THREE.LinearFilter;
            buildMesh(maskTex);
          }, undefined, () => buildMesh(null));
        } else {
          buildMesh(null);
        }
      }, undefined, () => done());
    });

    /* ── Animated scan ring ───────────────────────────────────── */
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.79, 0.013, 14, 120),
      new THREE.MeshBasicMaterial({ color:0x00ddff, transparent:true, opacity:0.88 })
    );
    scene.add(ring); ringRef.current = ring;
    ring.add(new THREE.Mesh(
      new THREE.TorusGeometry(1.79, 0.06, 8, 120),
      new THREE.MeshBasicMaterial({ color:0x00ddff, transparent:true, opacity:0.09 })
    ));

    /* ── Animate ──────────────────────────────────────────────── */
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clockRef.current.getElapsedTime();
      if (st.current.autoRot) { st.current.theta += 0.0022; moveCam(); }
      if (ringRef.current) {
        ringRef.current.position.y = Math.sin(t * 0.52) * 1.55;
        ringRef.current.material.opacity = 0.60 + 0.35 * Math.abs(Math.sin(t * 1.5));
      }
      renderer.render(scene, camera);
    };
    animate();

    /* ── Resize ───────────────────────────────────────────────── */
    const ro = new ResizeObserver(() => {
      const w=el.clientWidth,h=el.clientHeight; if(!w||!h) return;
      camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect(); renderer.dispose();
      if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [slices, backendUrl, moveCam]);

  /* ── Controls ─────────────────────────────────────────────────────────── */
  useEffect(()=>{
    const el = mountRef.current; if(!el) return;
    const s = st.current;
    const dn = e =>{ s.dragging=true; s.rightDrag=e.button===2; s.autoRot=false; s.last={x:e.clientX,y:e.clientY}; };
    const mv = e =>{
      if(!s.dragging) return;
      const dx=e.clientX-s.last.x, dy=e.clientY-s.last.y; s.last={x:e.clientX,y:e.clientY};
      if(s.rightDrag){ s.panX-=dx*0.01; s.panY+=dy*0.01; }
      else{ s.theta-=dx*0.008; s.phi=Math.max(0.12,Math.min(Math.PI-0.12,s.phi-dy*0.008)); }
      moveCam();
    };
    const up = ()=>{ s.dragging=false; };
    const wh = e =>{ e.preventDefault(); s.radius=Math.max(1.8,Math.min(14,s.radius+e.deltaY*0.012)); moveCam(); };
    const kd = e =>{
      const sp=0.08;
      if     (e.key==='ArrowLeft')  s.panX-=sp;
      else if(e.key==='ArrowRight') s.panX+=sp;
      else if(e.key==='ArrowUp')    s.panY+=sp;
      else if(e.key==='ArrowDown')  s.panY-=sp;
      else if(e.key==='r'||e.key==='R') Object.assign(s,{theta:-0.45,phi:0.92,radius:5.6,panX:0,panY:0,autoRot:true});
      else return; moveCam();
    };
    el.addEventListener('mousedown', dn);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    el.addEventListener('wheel', wh, {passive:false});
    el.addEventListener('contextmenu', e=>e.preventDefault());
    window.addEventListener('keydown', kd);
    return ()=>{
      el.removeEventListener('mousedown', dn);
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      el.removeEventListener('wheel', wh);
      window.removeEventListener('keydown', kd);
    };
  }, [moveCam]);

  const pct      = total>0 ? Math.round((loaded/total)*100) : 0;
  const hasTumor = (slices||[]).some(s=>s.has_tumor);

  return (
    <div className="viewer3d-root">
      <div ref={mountRef} className="viewer3d-canvas" tabIndex={0} />

      {!ready && (
        <div className="viewer3d-overlay">
          <div className="viewer3d-spinner" />
          <p style={{marginTop:14,fontSize:13,color:'var(--text-muted)'}}>
            Loading MRI volume… {pct}%
          </p>
          <div className="viewer3d-progress">
            <div className="viewer3d-progress-bar" style={{width:`${pct}%`}} />
          </div>
        </div>
      )}

      {ready && (
        <div className="viewer3d-axis-labels" style={{display:'flex',flexDirection:'column',gap:5,fontSize:11}}>
          <span style={{color:'#aaccee'}}>■ Brain Tissue (MRI greyscale)</span>
          {hasTumor && <span style={{color:'#cc1122'}}>■ Tumor Pixels (mask)</span>}
          <span style={{color:'#00ddff',fontSize:10}}>— Axial scan plane</span>
        </div>
      )}

      {ready && (
        <div className="viewer3d-legend">
          <span>🖱 Drag: orbit</span>
          <span>Right-drag: pan</span>
          <span>Scroll: zoom in/out</span>
          <span>R: reset view</span>
        </div>
      )}

      {ready && (
        <div style={{
          position:'absolute',bottom:12,right:12,
          display:'flex',alignItems:'center',gap:6,fontSize:10,
          color:'#00ddff',background:'rgba(1,4,8,0.9)',
          padding:'4px 10px',borderRadius:20,
          border:'1px solid rgba(0,210,255,0.25)',
        }}>
          <span style={{
            display:'inline-block',width:6,height:6,borderRadius:'50%',
            background:'#00ddff',boxShadow:'0 0 8px #00ddff',
            animation:'pulse3d 1.4s ease-in-out infinite',
          }} />
          Volumetric MRI
        </div>
      )}
    </div>
  );
}
