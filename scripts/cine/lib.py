"""Spindledeep cinematics: scene-building library (runs inside Blender 4.2, EEVEE Next).

Every frame is rendered as data, not as a finished picture: a linear beauty pass plus depth, normal,
world position and an 'aux' mask (R = red thread glow, G = blown snow, B = warm light that keeps its colour).
post.py turns those into the game's intaglio engraving, so the films and the game share one look.
"""
import math
import os
import random

import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

TAU = math.pi * 2
V = Vector


# ── scene & render ─────────────────────────────────────────────────────────
def setattr_safe(obj, name, value):
    try:
        setattr(obj, name, value)
    except Exception as e:  # attribute moved between Blender versions: not fatal
        print('  (skip', type(obj).__name__ + '.' + name, '-', e, ')')


def new_scene(frames, out_dir, w=1280, h=720, samples=16, preview=False, pos_lo=(-80, -60, -45), pos_size=200.0):
    """Every pass is written as a 16-bit PNG with a known encoding (no EXR reader needed downstream):
    beauty = sqrt(rgb / 16), normal = n*0.5+0.5, pos = (P - lo) / size, depth = ln(1+d) / ln(1001), aux raw.
    The view transform is Raw so nothing else touches the numbers."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    r = sc.render
    r.engine = 'BLENDER_EEVEE_NEXT'
    r.resolution_x, r.resolution_y = w, h
    r.resolution_percentage = 50 if preview else 100
    r.fps = 24
    r.film_transparent = False
    r.use_motion_blur = False
    ee = sc.eevee
    setattr_safe(ee, 'taa_render_samples', 8 if preview else samples)
    setattr_safe(ee, 'use_shadows', True)
    setattr_safe(ee, 'shadow_ray_count', 2)
    setattr_safe(ee, 'shadow_step_count', 8)
    setattr_safe(ee, 'use_volumetric_shadows', True)
    setattr_safe(ee, 'volumetric_tile_size', '8' if preview else '4')
    setattr_safe(ee, 'volumetric_samples', 32 if preview else 64)
    setattr_safe(ee, 'volumetric_start', 0.1)
    setattr_safe(ee, 'volumetric_end', 140)
    setattr_safe(ee, 'use_raytracing', True)
    setattr_safe(ee, 'use_gtao', True)
    sc.view_settings.view_transform = 'Raw'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    vl = sc.view_layers[0]
    vl.use_pass_z = True
    vl.use_pass_normal = True
    for name in ('pos', 'aux'):
        a = vl.aovs.add(); a.name = name; a.type = 'COLOR'
    sc.use_nodes = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers')

    def mix(a, col, op):
        m = nt.nodes.new('CompositorNodeMixRGB'); m.blend_type = op; m.use_clamp = False
        m.inputs[0].default_value = 1.0
        nt.links.new(a, m.inputs[1]); m.inputs[2].default_value = (*col, 1)
        return m.outputs[0]

    def math1(a, op, b):
        m = nt.nodes.new('CompositorNodeMath'); m.operation = op; m.use_clamp = False
        nt.links.new(a, m.inputs[0]); m.inputs[1].default_value = b
        return m.outputs[0]
    beauty = mix(rl.outputs['Image'], (1 / 16, 1 / 16, 1 / 16), 'MULTIPLY')
    gm = nt.nodes.new('CompositorNodeGamma'); gm.inputs['Gamma'].default_value = 0.5
    nt.links.new(beauty, gm.inputs['Image']); beauty = gm.outputs[0]
    def per_channel(src, add, mul):
        # colour sockets clamp to 0..1, so offsets go through plain math nodes channel by channel
        sp = nt.nodes.new('CompositorNodeSeparateColor'); nt.links.new(src, sp.inputs[0])
        cb = nt.nodes.new('CompositorNodeCombineColor')
        for i in range(3):
            nt.links.new(math1(math1(sp.outputs[i], 'ADD', add[i]), 'MULTIPLY', mul), cb.inputs[i])
        return cb.outputs[0]
    normal = per_channel(rl.outputs['Normal'], (1.0, 1.0, 1.0), 0.5)
    lo = pos_lo
    pos = per_channel(rl.outputs['pos'], (-lo[0], -lo[1], -lo[2]), 1.0 / pos_size)
    d = math1(math1(math1(rl.outputs['Depth'], 'ADD', 1.0), 'LOGARITHM', math.e), 'DIVIDE', math.log(1001.0))
    cc = nt.nodes.new('CompositorNodeCombineColor')
    for i in range(3):
        nt.links.new(d, cc.inputs[i])
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(beauty, comp.inputs['Image'])
    fo = nt.nodes.new('CompositorNodeOutputFile')
    fo.base_path = out_dir
    fo.format.file_format = 'PNG'
    fo.format.color_mode = 'RGB'
    fo.format.color_depth = '16'
    fo.format.compression = 15
    fo.file_slots.clear()
    for slot, src in (('beauty_', beauty), ('normal_', normal), ('pos_', pos), ('aux_', rl.outputs['aux']), ('depth_', cc.outputs[0])):
        fo.file_slots.new(slot)
        nt.links.new(src, fo.inputs[slot])
    r.filepath = os.path.join(out_dir, 'preview_')
    r.image_settings.file_format = 'JPEG'
    r.image_settings.quality = 80
    with open(os.path.join(out_dir, 'encoding.txt'), 'w') as fh:
        fh.write(f'{lo[0]} {lo[1]} {lo[2]} {pos_size}' + chr(10))
    return sc


def world(sc, top=(0.02, 0.025, 0.035), horizon=(0.05, 0.05, 0.06), strength=1.0, fog=0.0, fog_color=(0.8, 0.82, 0.9), aniso=0.2, fog_bounds=((-120, -80, -50), (140, 160, 60))):
    w = bpy.data.worlds.new('World'); sc.world = w
    w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.45; ramp.color_ramp.elements[0].color = (*horizon, 1)
    ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = (*top, 1)
    mp = nt.nodes.new('ShaderNodeMapRange')
    mp.inputs['From Min'].default_value = -1; mp.inputs['From Max'].default_value = 1
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mp.inputs['Value'])
    nt.links.new(mp.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    if fog > 0:
        fog_box(fog, fog_color, aniso, fog_bounds)
    return w


def fog_box(density, color=(0.8, 0.82, 0.9), aniso=0.2, bounds=((-120, -80, -50), (140, 160, 60))):
    """atmosphere as a finite volume object: in EEVEE Next a world volume also absorbs the sun completely"""
    m = bpy.data.materials.new('fog'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = density
    vol.inputs['Color'].default_value = (*color, 1)
    vol.inputs['Anisotropy'].default_value = aniso
    setattr_safe(vol.inputs['Absorption Color'], 'default_value', (*color, 1))
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    lo, hi = bounds
    bpy.ops.mesh.primitive_cube_add(location=[(a + b) / 2 for a, b in zip(lo, hi)])
    o = bpy.context.active_object; o.name = 'fogbox'
    o.scale = [(b - a) / 2 for a, b in zip(lo, hi)]
    o.data.materials.append(m)
    return o


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


# ── materials ──────────────────────────────────────────────────────────────
def _aov(nt, out_node, aux):
    """every material writes its world position and its aux mask into the AOV passes"""
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    a1 = nt.nodes.new('ShaderNodeOutputAOV'); a1.aov_name = 'pos'
    nt.links.new(geo.outputs['Position'], a1.inputs['Color'])
    a2 = nt.nodes.new('ShaderNodeOutputAOV'); a2.aov_name = 'aux'
    if isinstance(aux, (tuple, list)):
        a2.inputs['Color'].default_value = (*aux, 1)
    else:
        nt.links.new(aux, a2.inputs['Color'])


def mat(name, color=(0.5, 0.5, 0.5), rough=0.8, metal=0.0, emit=None, estr=0.0, sss=0.0, sheen=0.0,
        bump=None, bump_scale=8.0, bump_str=0.25, aux=(0, 0, 0), alpha=1.0, blended=False, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    setattr_safe(b.inputs['Specular IOR Level'], 'default_value', spec)
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = estr
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (0.3, 0.2, 0.15)
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    if bump:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        if bump == 'noise':
            tx = nt.nodes.new('ShaderNodeTexNoise'); tx.inputs['Scale'].default_value = bump_scale; tx.inputs['Detail'].default_value = 8
            nt.links.new(tc.outputs['Object'], tx.inputs['Vector']); h = tx.outputs['Fac']
        elif bump == 'wood':
            tx = nt.nodes.new('ShaderNodeTexWave'); tx.inputs['Scale'].default_value = bump_scale
            tx.inputs['Distortion'].default_value = 6; tx.inputs['Detail'].default_value = 6
            tx.bands_direction = 'X'
            nt.links.new(tc.outputs['Object'], tx.inputs['Vector']); h = tx.outputs['Fac']
        elif bump == 'knit':
            # rows of knitted loops: a wave across rows, broken up by a voronoi of loop heads
            tx = nt.nodes.new('ShaderNodeTexWave'); tx.inputs['Scale'].default_value = bump_scale
            tx.wave_profile = 'SIN'; tx.bands_direction = 'Z'; tx.inputs['Distortion'].default_value = 0.6
            vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = bump_scale * 2.2
            nt.links.new(tc.outputs['Object'], tx.inputs['Vector']); nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
            mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'
            nt.links.new(tx.outputs['Fac'], mx.inputs[0]); nt.links.new(vo.outputs['Distance'], mx.inputs[1]); h = mx.outputs[0]
        elif bump == 'rock':
            tx = nt.nodes.new('ShaderNodeTexVoronoi'); tx.inputs['Scale'].default_value = bump_scale
            setattr_safe(tx, 'feature', 'F1')
            n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = bump_scale * 4; n2.inputs['Detail'].default_value = 10
            nt.links.new(tc.outputs['Object'], tx.inputs['Vector']); nt.links.new(tc.outputs['Object'], n2.inputs['Vector'])
            mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'ADD'
            nt.links.new(tx.outputs['Distance'], mx.inputs[0]); nt.links.new(n2.outputs['Fac'], mx.inputs[1]); h = mx.outputs[0]
        bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump_str
        nt.links.new(h, bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    _aov(nt, out, aux)
    if alpha < 1 or blended:
        setattr_safe(m, 'surface_render_method', 'BLENDED')
        setattr_safe(m, 'blend_method', 'BLEND')
    return m


def emissive(name, color, strength, aux=(0, 0, 1)):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs['Emission'], out.inputs['Surface'])
    _aov(nt, out, aux)
    return m


def thread_mat(name, color, strength, aux, progress_from=None):
    """a yarn thread: wool shading plus a glow; with progress_from=(rgb, prop object) the colour flows
    along the curve's length (UV x) as the object's 'progress' custom property animates 0→1"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = 0.9
    setattr_safe(b.inputs['Sheen Weight'], 'default_value', 0.6)
    col = nt.nodes.new('ShaderNodeRGB'); col.outputs[0].default_value = (*color, 1)
    st = nt.nodes.new('ShaderNodeValue'); st.outputs[0].default_value = strength
    auxn = nt.nodes.new('ShaderNodeRGB'); auxn.outputs[0].default_value = (*aux, 1)
    c_out, s_out, a_out = col.outputs[0], st.outputs[0], auxn.outputs[0]
    if progress_from:
        rgb0, holder = progress_from
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['UV'], sep.inputs[0])
        attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_type = 'OBJECT'; attr.attribute_name = '["progress"]'
        sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'
        nt.links.new(attr.outputs['Fac'], sub.inputs[0]); nt.links.new(sep.outputs['X'], sub.inputs[1])
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.02; mr.inputs['From Max'].default_value = 0.04
        nt.links.new(sub.outputs[0], mr.inputs['Value'])
        c0 = nt.nodes.new('ShaderNodeRGB'); c0.outputs[0].default_value = (*rgb0, 1)
        mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'
        nt.links.new(mr.outputs['Result'], mixc.inputs['Factor']); nt.links.new(c0.outputs[0], mixc.inputs[6]); nt.links.new(col.outputs[0], mixc.inputs[7])
        mixs = nt.nodes.new('ShaderNodeMath'); mixs.operation = 'MULTIPLY'
        nt.links.new(mr.outputs['Result'], mixs.inputs[0]); nt.links.new(st.outputs[0], mixs.inputs[1])
        mixa = nt.nodes.new('ShaderNodeMix'); mixa.data_type = 'RGBA'
        z = nt.nodes.new('ShaderNodeRGB'); z.outputs[0].default_value = (0, 0, 0, 1)
        nt.links.new(mr.outputs['Result'], mixa.inputs['Factor']); nt.links.new(z.outputs[0], mixa.inputs[6]); nt.links.new(auxn.outputs[0], mixa.inputs[7])
        c_out, s_out, a_out = mixc.outputs[2], mixs.outputs[0], mixa.outputs[2]
    nt.links.new(c_out, b.inputs['Base Color'])
    nt.links.new(c_out, b.inputs['Emission Color'])
    nt.links.new(s_out, b.inputs['Emission Strength'])
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    _aov(nt, out, a_out)
    return m


# ── mesh helpers ───────────────────────────────────────────────────────────
def mesh_obj(name, verts, faces, material=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    if material:
        me.materials.append(material)
    return link(o)


def prim(kind, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), material=None, smooth=True, **kw):
    ops = {'cube': bpy.ops.mesh.primitive_cube_add, 'cyl': bpy.ops.mesh.primitive_cylinder_add,
           'sphere': bpy.ops.mesh.primitive_uv_sphere_add, 'ico': bpy.ops.mesh.primitive_ico_sphere_add,
           'cone': bpy.ops.mesh.primitive_cone_add, 'torus': bpy.ops.mesh.primitive_torus_add,
           'plane': bpy.ops.mesh.primitive_plane_add}
    ops[kind](location=loc, rotation=rot, **kw)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    if material:
        o.data.materials.append(material)
    if smooth and kind != 'cube' and kind != 'plane':
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def parent(child, par, keep=True):
    mw = child.matrix_world.copy()
    child.parent = par
    if keep:
        child.matrix_parent_inverse = par.matrix_world.inverted()
    return child


def empty(name, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); o.location = loc
    return link(o)


def curve_obj(name, pts, bevel=0.004, material=None, res=4, kind='NURBS', uv=True, order=3):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = bevel; cu.bevel_resolution = res; cu.use_fill_caps = True
    sp = cu.splines.new(kind)
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (c[0], c[1], c[2], 1)
    sp.use_endpoint_u = True
    sp.order_u = min(order, len(pts))
    o = bpy.data.objects.new(name, cu)
    if material:
        cu.materials.append(material)
    return link(o)


def displace(o, strength=0.2, scale=1.0, subdiv=0, tex='CLOUDS', axis='NORMAL'):
    if subdiv:
        m = o.modifiers.new('sub', 'SUBSURF'); m.levels = subdiv; m.render_levels = subdiv; m.subdivision_type = 'SIMPLE'
    t = bpy.data.textures.new(o.name + '_dt', tex)
    if tex == 'CLOUDS':
        t.noise_scale = scale; t.noise_depth = 4
    elif tex == 'VORONOI':
        t.noise_scale = scale
    d = o.modifiers.new('disp', 'DISPLACE'); d.texture = t; d.strength = strength; d.mid_level = 0.5; d.direction = axis
    d.texture_coords = 'GLOBAL'
    return d


def key(o, path, frame, value, index=-1, interp='BEZIER'):
    if index >= 0:
        getattr(o, path)[index] = value
    else:
        setattr(o, path, value)
    o.keyframe_insert(path, index=index, frame=frame)
    if o.animation_data and o.animation_data.action:
        for fc in o.animation_data.action.fcurves:
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    kp.interpolation = interp


def eval_fc(o, path, frame, default):
    """value of an animated vector property at a (sub)frame, without touching the depsgraph"""
    if not (o.animation_data and o.animation_data.action):
        return V(default)
    vals = list(default)
    for fc in o.animation_data.action.fcurves:
        if fc.data_path == path:
            vals[fc.array_index] = fc.evaluate(frame)
    return V(vals)


# ── camera ─────────────────────────────────────────────────────────────────
def camera(name='Cam', lens=35, fstop=None, sensor=36):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = sensor
    cd.clip_start = 0.02; cd.clip_end = 400
    o = link(bpy.data.objects.new(name, cd))
    bpy.context.scene.camera = o
    tgt = empty(name + '_tgt')
    c = o.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    if fstop:
        cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop; cd.dof.focus_object = None
    o['tgt'] = tgt.name
    return o, tgt


def cam_keys(cam, tgt, keys, ease='BEZIER'):
    """keys: [(frame, (x,y,z) cam, (x,y,z) target, lens or None, focus distance or None)]"""
    for f, p, t, lens, foc in keys:
        key(cam, 'location', f, V(p))
        key(tgt, 'location', f, V(t))
        if lens:
            cam.data.lens = lens; cam.data.keyframe_insert('lens', frame=f)
        if foc and cam.data.dof.use_dof:
            cam.data.dof.focus_distance = foc; cam.data.dof.keyframe_insert('focus_distance', frame=f)
    for o in (cam, tgt, cam.data):
        if o.animation_data and o.animation_data.action:
            for fc in o.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = ease
                    kp.easing = 'EASE_IN_OUT'


def handheld(cam, amp=0.01, freq=0.6, seed=1):
    """a breath of hand-held drift: noise modifiers on the camera's location curves"""
    if not (cam.animation_data and cam.animation_data.action):
        return
    for fc in cam.animation_data.action.fcurves:
        if fc.data_path == 'location':
            m = fc.modifiers.new('NOISE'); m.scale = 24 / freq; m.strength = amp * 2; m.phase = seed * 7 + fc.array_index * 13


# ── lights ─────────────────────────────────────────────────────────────────
def light(kind, name, loc, energy, color=(1, 1, 1), size=0.1, rot=(0, 0, 0), spot=None, shadow=True):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind in ('POINT', 'SPOT'):
        ld.shadow_soft_size = size
    elif kind == 'AREA':
        ld.size = size
    elif kind == 'SUN':
        ld.angle = size
    if spot and kind == 'SPOT':
        ld.spot_size = spot; ld.spot_blend = 0.6
    setattr_safe(ld, 'use_shadow', shadow)
    o = link(bpy.data.objects.new(name, ld)); o.location = loc; o.rotation_euler = rot
    return o


def flicker(lamp, base, amount=0.25, speed=1.0, seed=0):
    ld = lamp.data
    ld.energy = base; ld.keyframe_insert('energy', frame=1)
    fc = ld.animation_data.action.fcurves[0]
    m = fc.modifiers.new('NOISE'); m.scale = 2.2 / speed; m.strength = base * amount; m.phase = seed
    m2 = fc.modifiers.new('NOISE'); m2.scale = 0.6 / speed; m2.strength = base * amount * 0.4; m2.phase = seed + 31


# ── snow: thousands of camera-facing streaks rebuilt every frame from a closed-form wind ─────────
class Snow:
    def __init__(self, name, n, box_min, box_max, wind=(7.0, 0.0, -1.6), gust=0.45, streak=0.035, width=0.012,
                 cam=None, tgt=None, material=None, seed=3, still=False):
        rng = np.random.default_rng(seed)
        self.n = n; self.lo = np.array(box_min, float); self.hi = np.array(box_max, float)
        self.p0 = self.lo + rng.random((n, 3)) * (self.hi - self.lo)
        self.var = 0.75 + rng.random((n, 1)) * 0.5
        self.wob = rng.random((n, 3)) * TAU
        self.wind = np.array(wind, float); self.gust = gust; self.streak = streak; self.width = width
        self.cam, self.tgt, self.still = cam, tgt, still
        self.size = rng.random((n, 1)) * 0.8 + 0.6
        me = bpy.data.meshes.new(name)
        verts = np.zeros((n * 4, 3)); faces = [(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3) for i in range(n)]
        me.from_pydata(verts.tolist(), [], faces)
        me.update()
        self.obj = link(bpy.data.objects.new(name, me))
        if material:
            me.materials.append(material)
        self.update(1)

    def offset(self, t):
        # ∫ wind(t) dt with gusts as two slow sines → displacement at time t (seconds)
        g = self.gust
        sx = self.wind[0] * (t + g * (-math.cos(t * 0.37) / 0.37 * 0.6 - math.cos(t * 0.91 + 1.2) / 0.91 * 0.4))
        return np.array([sx, self.wind[1] * t, self.wind[2] * t])

    def speed(self, t):
        g = self.gust
        return np.array([self.wind[0] * (1 + g * (0.6 * math.sin(t * 0.37) + 0.4 * math.sin(t * 0.91 + 1.2))), self.wind[1], self.wind[2]])

    def update(self, frame):
        t = (frame - 1) / 24.0
        off = self.offset(t)
        size = self.hi - self.lo
        wob = 0.25 * np.sin(self.wob + t * np.array([2.1, 1.7, 2.6]))
        p = self.lo + np.mod(self.p0 + off * self.var + wob - self.lo, size)
        v = self.speed(t)[None, :] * self.var + np.cos(self.wob + t * 2.0) * 0.4
        sp = np.linalg.norm(v, axis=1, keepdims=True) + 1e-6
        d = v / sp
        L = (sp * self.streak) * self.size
        camp = np.array(eval_fc(self.cam, 'location', frame, self.cam.location)) if self.cam else np.array([0, -10, 2.0])
        view = p - camp[None, :]
        view /= np.linalg.norm(view, axis=1, keepdims=True) + 1e-6
        side = np.cross(d, view)
        side /= np.linalg.norm(side, axis=1, keepdims=True) + 1e-6
        dist = np.linalg.norm(p - camp[None, :], axis=1, keepdims=True)
        # flakes right at the lens get thin (they would be out of focus), the closest vanish
        w = self.width * self.size * 0.5 * np.clip(dist / 8.0, 0.2, 1.0) * (dist > 1.2)
        a = p; b = p - d * L
        verts = np.empty((self.n, 4, 3))
        verts[:, 0] = a + side * w; verts[:, 1] = b + side * w; verts[:, 2] = b - side * w; verts[:, 3] = a - side * w
        me = self.obj.data
        me.vertices.foreach_set('co', verts.reshape(-1).astype(np.float32))
        me.update()


SNOWS = []


def snow_handler(scene, *_):
    f = scene.frame_current + scene.frame_subframe
    for s in SNOWS:
        s.update(f)


def register_snow():
    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(snow_handler)


# ── props ──────────────────────────────────────────────────────────────────
def M():
    """the shared material set"""
    if 'snow' in bpy.data.materials:
        return {m.name: m for m in bpy.data.materials}
    d = {}
    d['snow'] = mat('snow', (0.86, 0.88, 0.92), rough=0.55, sss=0.15, bump='noise', bump_scale=14, bump_str=0.15)
    d['rock'] = mat('rock', (0.09, 0.085, 0.09), rough=0.95, bump='rock', bump_scale=1.6, bump_str=0.6)
    d['log'] = mat('log', (0.24, 0.17, 0.11), rough=0.85, bump='wood', bump_scale=3, bump_str=0.35)
    d['logend'] = mat('logend', (0.42, 0.32, 0.2), rough=0.8, bump='noise', bump_scale=30, bump_str=0.2)
    d['plank'] = mat('plank', (0.3, 0.22, 0.14), rough=0.8, bump='wood', bump_scale=5, bump_str=0.3)
    d['darkwood'] = mat('darkwood', (0.13, 0.09, 0.06), rough=0.7, bump='wood', bump_scale=6, bump_str=0.25)
    d['stone'] = mat('stone', (0.28, 0.27, 0.27), rough=0.9, bump='rock', bump_scale=4, bump_str=0.5)
    d['shingle'] = mat('shingle', (0.16, 0.13, 0.11), rough=0.9, bump='noise', bump_scale=12, bump_str=0.3)
    d['iron'] = mat('iron', (0.08, 0.08, 0.085), rough=0.5, metal=0.8, bump='noise', bump_scale=40, bump_str=0.1)
    d['wool_grey'] = mat('wool_grey', (0.34, 0.33, 0.32), rough=1.0, sheen=0.8, bump='knit', bump_scale=70, bump_str=1.0)
    d['wool_dark'] = mat('wool_dark', (0.12, 0.11, 0.12), rough=1.0, sheen=0.6, bump='knit', bump_scale=30, bump_str=0.4)
    d['wool_shawl'] = mat('wool_shawl', (0.3, 0.29, 0.3), rough=1.0, sheen=0.7, bump='knit', bump_scale=26, bump_str=0.5)
    d['coat'] = mat('coat', (0.1, 0.11, 0.14), rough=1.0, sheen=0.5, bump='noise', bump_scale=60, bump_str=0.2)
    d['ribbon'] = mat('ribbon', (0.92, 0.9, 0.86), rough=0.35, sheen=0.4)
    d['button'] = mat('button', (0.05, 0.045, 0.05), rough=0.15, spec=0.9)
    d['felt'] = mat('felt', (0.2, 0.18, 0.17), rough=1.0, sheen=0.5, bump='noise', bump_scale=80, bump_str=0.15)
    d['skin'] = mat('skin', (0.55, 0.42, 0.36), rough=0.6, sss=0.3)
    d['cloth_dark'] = mat('cloth_dark', (0.07, 0.065, 0.075), rough=1.0, sheen=0.4, bump='noise', bump_scale=20, bump_str=0.15)
    d['red'] = thread_mat('red', (0.85, 0.06, 0.04), 2.2, (1, 0, 0))
    d['grey_thread'] = mat('grey_thread', (0.55, 0.55, 0.56), rough=0.95, sheen=0.5)
    d['flame'] = emissive('flame', (1.0, 0.62, 0.25), 40, aux=(0, 0, 1))
    d['ember'] = emissive('ember', (1.0, 0.4, 0.12), 12, aux=(0, 0, 1))
    d['wax'] = mat('wax', (0.85, 0.8, 0.68), rough=0.4, sss=0.6)
    d['flake'] = mat('flake', (1, 1, 1), rough=0.6, emit=(0.8, 0.84, 0.95), estr=0.25, aux=(0, 1, 0))
    d['black'] = mat('black', (0.0, 0.0, 0.0), rough=1.0)
    d['paper'] = mat('paper', (0.85, 0.8, 0.7), rough=0.9)
    return d


def log_wall(name, x0, x1, z0, height, y, r=0.17, mat_log=None, mat_end=None, gaps=(), overhang=0.25):
    """a wall of horizontal logs along X at depth y; gaps = [(xa, xb, za, zb)] openings (window, door)"""
    objs = []
    z = z0 + r
    i = 0
    while z < z0 + height:
        segs = [(x0 - overhang, x1 + overhang)]
        for (xa, xb, za, zb) in gaps:
            if za - r * 0.5 < z < zb + r * 0.5:
                nsegs = []
                for (a, b) in segs:
                    if xb <= a or xa >= b:
                        nsegs.append((a, b))
                    else:
                        if xa > a:
                            nsegs.append((a, xa))
                        if xb < b:
                            nsegs.append((xb, b))
                segs = nsegs
        for (a, b) in segs:
            L = b - a
            if L < 0.05:
                continue
            o = prim('cyl', f'{name}_{i}', loc=((a + b) / 2, y, z), rot=(0, math.pi / 2, 0), scale=(r * (0.95 + 0.1 * random.random()), r, L / 2),
                     material=mat_log, vertices=20)
            o.data.materials.append(mat_end)
            # end caps get the end-grain material
            for p in o.data.polygons:
                if abs(p.normal.z) > 0.9:
                    p.material_index = 1
            objs.append(o)
            i += 1
        z += r * 1.82
    return objs


def bare_tree(name, base, height, seed, mat_bark):
    rng = random.Random(seed)
    objs = []

    def grow(p, d, length, radius, depth):
        end = p + d * length
        mid = (p + end) / 2 + V((rng.random() - 0.5, rng.random() - 0.5, rng.random() - 0.5)) * length * 0.2
        o = curve_obj(f'{name}_b{len(objs)}', [p, mid, end], bevel=radius, material=mat_bark, res=2)
        cu = o.data
        # taper toward the tip
        tp = bpy.data.curves.new(f'{name}_tp{len(objs)}', 'CURVE')
        objs.append(o)
        if depth <= 0 or radius < 0.006:
            return
        n = 2 if depth > 3 else 2 + (rng.random() < 0.45)
        for i in range(n):
            a = d.copy()
            a.rotate(Euler(((rng.random() - 0.5) * 1.2, (rng.random() - 0.5) * 1.2 + (i - (n - 1) / 2) * 0.6, rng.random() * 0.8)))
            a.normalize()
            grow(end, a, length * (0.6 + rng.random() * 0.2), radius * 0.62, depth - 1)

    grow(V(base), V((0.05, 0, 1)).normalized(), height * 0.36, height * 0.022, 6)
    return objs


def woodpile(name, x0, x1, y0, y1, z, seed, mats):
    """logs dropped into a heap like the game's woodpile, seen end-on; each is a short cylinder along Y"""
    rng = random.Random(seed)
    logs = []

    def rest(x, r):
        y = z + r
        for (ox, oz, orr) in logs:
            dx = x - ox; rr = r + orr
            if abs(dx) < rr:
                y = max(y, oz + math.sqrt(rr * rr - dx * dx))
        return y
    for _ in range(80):
        if len(logs) >= 32:
            break
        r = 0.09 + rng.random() * 0.08
        x = x0 + r + rng.random() * (x1 - x0 - 2 * r)
        zz = rest(x, r)
        for _it in range(50):
            sup = [(ox, oz, orr) for (ox, oz, orr) in logs if abs(x - ox) < r + orr and abs(oz + math.sqrt(max(0, (r + orr) ** 2 - (x - ox) ** 2)) - zz) < 1e-3]
            if not sup:
                break
            ox = sup[0][0]
            nx = x + (0.015 if x >= ox else -0.015)
            if nx - r < x0 or nx + r > x1:
                break
            nz = rest(nx, r)
            if nz > zz - 1e-4 and len(sup) > 1:
                break
            x, zz = nx, nz
        if zz + r > z + 1.5:
            continue
        logs.append((x, zz, r))
    objs = []
    for i, (x, zz, r) in enumerate(logs):
        L = (y1 - y0) * (0.85 + rng.random() * 0.25)
        o = prim('cyl', f'{name}_{i}', loc=(x, (y0 + y1) / 2 + (rng.random() - 0.5) * 0.15, zz), rot=(math.pi / 2, 0, rng.random()),
                 scale=(r, r * (0.9 + rng.random() * 0.15), L / 2), material=mats['log'], vertices=14)
        o.data.materials.append(mats['logend'])
        for p in o.data.polygons:
            if abs(p.normal.z) > 0.9:
                p.material_index = 1
        objs.append(o)
    return objs


def doll(name, loc=(0, 0, 0), scale=1.0, mats=None, pose='stand'):
    """the yarn doll: knitted head and body, button eye and a cross-stitched one, ribbon sash, coat patch,
    mitten hands, felt feet, a tuft of yarn loops. ~0.34 m tall at scale 1. Returns (root, parts dict)."""
    m = mats
    root = empty(name, loc)
    root.scale = (scale, scale, scale)
    P = {}

    def part(o, key=None):
        parent(o, root, keep=False)
        if key:
            P[key] = o
        return o
    body = part(prim('sphere', name + '_body', loc=(0, 0, 0.11), scale=(0.075, 0.065, 0.09), material=m['wool_grey'], segments=32, ring_count=16), 'body')
    head = part(prim('sphere', name + '_head', loc=(0, 0, 0.245), scale=(0.085, 0.078, 0.08), material=m['wool_grey'], segments=32, ring_count=16), 'head')
    # coat-sleeve patch on the chest
    part(prim('cube', name + '_patch', loc=(0.02, -0.06, 0.125), rot=(0.25, 0, 0.1), scale=(0.028, 0.006, 0.026), material=m['coat']))
    # ribbon sash across the body, bow at the hip
    sash = part(prim('torus', name + '_sash', loc=(0, 0, 0.11), rot=(0.0, 0.5, 0), major_radius=0.074, minor_radius=0.008, material=m['ribbon']))
    sash.scale = (1.0, 0.88, 1.0)
    for s in (-1, 1):
        part(prim('sphere', name + f'_bow{s}', loc=(0.07, -0.02 + s * 0.022, 0.07), scale=(0.012, 0.022, 0.016), material=m['ribbon'], segments=12, ring_count=8))
        part(prim('cube', name + f'_tail{s}', loc=(0.075, -0.02 + s * 0.012, 0.045), rot=(s * 0.25, 0.1, 0), scale=(0.004, 0.009, 0.026), material=m['ribbon']))
    # button eye (four holes) and a cross-stitched eye
    be = part(prim('cyl', name + '_btn', loc=(-0.03, -0.074, 0.255), rot=(math.pi / 2, 0, 0), scale=(0.018, 0.018, 0.004), material=m['button'], vertices=24), 'eye')
    for k in range(4):
        a = k * TAU / 4 + 0.785
        part(prim('cyl', name + f'_hole{k}', loc=(-0.03 + math.cos(a) * 0.007, -0.0785, 0.255 + math.sin(a) * 0.007), rot=(math.pi / 2, 0, 0), scale=(0.0022, 0.0022, 0.002), material=m['ribbon'], vertices=8))
    for s in (-1, 1):
        part(prim('cube', name + f'_x{s}', loc=(0.03, -0.075, 0.255), rot=(math.pi / 2, s * 0.785, 0), scale=(0.002, 0.016, 0.002), material=m['ribbon']))
    # stitched mouth
    for k in range(3):
        part(prim('cube', name + f'_m{k}', loc=(-0.012 + k * 0.012, -0.076, 0.212 + (0.003 if k == 1 else 0)), rot=(math.pi / 2, 0, 0), scale=(0.005, 0.0015, 0.0015), material=m['wool_dark']))
    # tuft of yarn loops
    tuft = part(empty(name + '_tuft', (0, 0, 0.32)), 'tuft')
    for k in range(3):
        t = prim('torus', name + f'_loop{k}', loc=(0, 0, 0.0), rot=(math.pi / 2, 0, (k - 1) * 0.5), major_radius=0.018, minor_radius=0.004, material=m['wool_grey'])
        t.location = ((k - 1) * 0.012, 0, 0.012)
        parent(t, tuft, keep=False)
    # arms and mitten hands, legs and felt feet
    for s in (-1, 1):
        arm = part(empty(name + f'_arm{s}', (s * 0.07, 0, 0.16)), f'arm{s}')
        a = prim('cyl', name + f'_armm{s}', loc=(0, 0, -0.04), scale=(0.018, 0.018, 0.045), material=m['wool_grey'], vertices=12)
        parent(a, arm, keep=False)
        h = prim('sphere', name + f'_hand{s}', loc=(0, 0, -0.09), scale=(0.024, 0.02, 0.026), material=m['wool_dark'], segments=16, ring_count=10)
        parent(h, arm, keep=False)
        arm.rotation_euler = (0, s * 0.35, 0)
        leg = part(prim('cyl', name + f'_leg{s}', loc=(s * 0.032, 0, 0.03), scale=(0.02, 0.02, 0.035), material=m['wool_grey'], vertices=12))
        part(prim('sphere', name + f'_foot{s}', loc=(s * 0.034, -0.012, 0.0), scale=(0.026, 0.034, 0.014), material=m['felt'], segments=16, ring_count=8))
    return root, P


def knitter(name, loc=(0, 0, 0), mats=None, seated=False):
    """the old knitter, built to be seen as a silhouette: long skirt, a shawl over her head and shoulders,
    a bent back. Returns (root, parts)."""
    m = mats
    root = empty(name, loc)
    P = {}

    def part(o, key=None):
        parent(o, root, keep=False)
        if key:
            P[key] = o
        return o
    if seated:
        part(prim('cyl', name + '_lap', loc=(0, -0.22, 0.52), rot=(math.pi / 2 - 0.1, 0, 0), scale=(0.22, 0.18, 0.24), material=m['cloth_dark'], vertices=24))
        part(prim('cone', name + '_skirt', loc=(0, -0.38, 0.25), scale=(0.3, 0.26, 0.28), material=m['cloth_dark'], vertices=24, radius1=1, radius2=0.7, depth=1))
        tz = 0.82
    else:
        part(prim('cone', name + '_skirt', loc=(0, 0, 0.45), scale=(0.34, 0.3, 0.46), material=m['cloth_dark'], vertices=28, radius1=1, radius2=0.42, depth=2))
        tz = 1.12
    torso = part(prim('sphere', name + '_torso', loc=(0, 0.04, tz), scale=(0.2, 0.16, 0.26), material=m['cloth_dark'], segments=24, ring_count=14), 'torso')
    torso.rotation_euler = (0.3, 0, 0)
    head = part(prim('sphere', name + '_head', loc=(0, -0.08, tz + 0.3), scale=(0.09, 0.1, 0.11), material=m['skin'], segments=24, ring_count=14), 'head')
    shawl = part(prim('sphere', name + '_shawl', loc=(0, -0.04, tz + 0.27), scale=(0.15, 0.15, 0.17), material=m['wool_shawl'], segments=24, ring_count=14), 'shawl')
    # the shawl falls over the shoulders and back
    part(prim('cone', name + '_shawl2', loc=(0, 0.04, tz + 0.02), rot=(0.25, 0, 0), scale=(0.3, 0.24, 0.3), material=m['wool_shawl'], vertices=28, radius1=1, radius2=0.35, depth=1))
    for s in (-1, 1):
        arm = part(empty(name + f'_arm{s}', (s * 0.2, 0.0, tz + 0.14)), f'arm{s}')
        a = prim('cyl', name + f'_up{s}', loc=(0, -0.04, -0.14), rot=(0.4, 0, 0), scale=(0.05, 0.05, 0.15), material=m['cloth_dark'], vertices=12)
        parent(a, arm, keep=False)
        f = prim('cyl', name + f'_fore{s}', loc=(0, -0.2, -0.24), rot=(1.3, 0, 0), scale=(0.042, 0.042, 0.13), material=m['cloth_dark'], vertices=12)
        parent(f, arm, keep=False)
        h = prim('sphere', name + f'_hand{s}', loc=(0, -0.33, -0.27), scale=(0.035, 0.05, 0.03), material=m['skin'], segments=12, ring_count=8)
        parent(h, arm, keep=False)
        P[f'hand{s}'] = h
    return root, P


def candle(name, loc, mats, height=0.12, lit=True, energy=6.0, seed=0):
    root = empty(name, loc)
    c = prim('cyl', name + '_wax', loc=(0, 0, height / 2), scale=(0.018, 0.018, height / 2), material=mats['wax'], vertices=20)
    parent(c, root, keep=False)
    d = prim('cyl', name + '_dish', loc=(0, 0, 0.004), scale=(0.05, 0.05, 0.004), material=mats['iron'], vertices=24)
    parent(d, root, keep=False)
    P = {'root': root}
    if lit:
        f = prim('sphere', name + '_flame', loc=(0, 0, height + 0.018), scale=(0.006, 0.006, 0.016), material=mats['flame'], segments=12, ring_count=8)
        parent(f, root, keep=False)
        L = light('POINT', name + '_light', (0, 0, height + 0.03), energy, color=(1.0, 0.6, 0.3), size=0.008)
        parent(L, root, keep=False)
        flicker(L, energy, 0.22, 1.0, seed)
        P['flame'] = f; P['light'] = L
    return P


def lantern(name, loc, mats, energy=20.0, seed=0):
    root = empty(name, loc)
    frame_m = mats['iron']
    for k in range(4):
        a = k * TAU / 4 + 0.785
        b = prim('cyl', name + f'_bar{k}', loc=(math.cos(a) * 0.05, math.sin(a) * 0.05, 0.08), scale=(0.004, 0.004, 0.08), material=frame_m, vertices=6)
        parent(b, root, keep=False)
    for z in (0.0, 0.16):
        p = prim('cyl', name + f'_plate{z}', loc=(0, 0, z), scale=(0.065, 0.065, 0.008), material=frame_m, vertices=16)
        parent(p, root, keep=False)
    hdl = prim('torus', name + '_handle', loc=(0, 0, 0.2), rot=(math.pi / 2, 0, 0), major_radius=0.035, minor_radius=0.004, material=frame_m)
    parent(hdl, root, keep=False)
    g = prim('cyl', name + '_glass', loc=(0, 0, 0.08), scale=(0.045, 0.045, 0.07), material=emissive(name + '_glow', (1.0, 0.65, 0.3), 6, (0, 0, 1)), vertices=16)
    parent(g, root, keep=False)
    L = light('POINT', name + '_light', (0, 0, 0.08), energy, color=(1.0, 0.62, 0.3), size=0.03)
    parent(L, root, keep=False)
    flicker(L, energy, 0.15, 0.8, seed)
    return root, L


# ── threads as tube meshes with UV x = fraction of length (so colour can flow along them) ─────
def _tube_geom(pts, radius, seg=8):
    pts = [V(p) for p in pts]
    n = len(pts)
    L = [0.0]
    for i in range(1, n):
        L.append(L[-1] + (pts[i] - pts[i - 1]).length)
    tot = max(L[-1], 1e-6)
    verts, uvs = [], []
    prev_side = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        up = V((0, 0, 1)) if abs(t.z) < 0.9 else V((1, 0, 0))
        side = t.cross(up).normalized()
        if prev_side is not None and side.dot(prev_side) < 0:
            side = -side
        prev_side = side
        up2 = side.cross(t).normalized()
        for k in range(seg):
            a = k / seg * TAU
            verts.append(p + (side * math.cos(a) + up2 * math.sin(a)) * radius)
    return verts, [l / tot for l in L]


def tube(name, pts, radius=0.003, material=None, seg=8):
    verts, us = _tube_geom(pts, radius, seg)
    n = len(pts)
    faces = []
    for i in range(n - 1):
        for k in range(seg):
            a = i * seg + k; b = i * seg + (k + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            uv.data[li].uv = (us[vi // seg], (vi % seg) / seg)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    if material:
        me.materials.append(material)
    o['seg'] = seg; o['radius'] = radius
    return o


def tube_update(o, pts):
    """move an existing tube's vertices to a new polyline with the same point count"""
    verts, _ = _tube_geom(pts, o['radius'], o['seg'])
    o.data.vertices.foreach_set('co', np.array([c for v in verts for c in v], dtype=np.float32))
    o.data.update()


FRAME_FNS = []


def frame_handler(scene, *_):
    f = scene.frame_current + scene.frame_subframe
    for s in SNOWS:
        s.update(f)
    for fn in FRAME_FNS:
        fn(f)


def register_frames():
    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(frame_handler)
    frame_handler(bpy.context.scene)


def catenary(a, b, sag, n=24, lift=None):
    a, b = V(a), V(b)
    pts = []
    for i in range(n):
        t = i / (n - 1)
        p = a.lerp(b, t)
        p.z -= sag * 4 * t * (1 - t)
        if lift:
            p.z = max(p.z, lift(p))
        pts.append(p)
    return pts


def frame_pos(center, direction, radius, lens, fill=0.8, sensor=36.0, aspect=16 / 9):
    """camera position that fits a sphere of `radius` around `center` (vertically) at `fill` of the frame,
    looking back along `direction`"""
    half_v = math.atan((sensor / aspect) / 2 / lens)
    d = radius / math.tan(half_v) / fill
    return V(center) + V(direction).normalized() * d
