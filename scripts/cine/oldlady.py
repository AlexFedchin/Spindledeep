"""The knitter, from the rigged old-lady model the user chose (Auto-Rig Pro FBX, kept next to the repo in
../old-lady-fbx or copied into .cache/old_lady).

How it is driven: the shots were written against the hand-built rig in lib (empties: 'torso', 'head', 'arm*' →
'sh*' → 'fore*' → 'hand*' with finger joints, posed by lib.arm_to / lib.hand_pose). Here that same control
skeleton is built as invisible empties, but placed at the model's own joints (so the IK lengths, the shoulder
pivots and the finger joints are hers), and every deforming bone of the model follows a helper empty parented under
its control joint with a Copy Transforms constraint. The shots, the IK and the hand poses work unchanged, and the
model's skin, clothes and face come along. Spine bending is shared over three spine bones by drivers; the third
finger and thumb joints follow the second by drivers.

Rest pose of the controls = the model's T-pose. After binding, the lib defaults are applied (a stoop, neck bent,
arms down or knitting, hands relaxed) so a shot that sets nothing still gets a natural old woman."""
import math
import os

import bpy
from mathutils import Matrix, Vector as V

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = [os.path.join(HERE, '.cache', 'old_lady'), os.path.normpath(os.path.join(ROOT, '..', 'old-lady-fbx'))]
FBX_NAME = os.path.join('source', 'Old Lady_rig_Pro.fbx')
SCALE = 0.87          # the model is 1.79 m to the top of her cap; the knitter is small: ~1.55 m
FINGERS = ('index', 'middle', 'ring', 'pinky')


def _src():
    for d in SRC:
        if os.path.exists(os.path.join(d, FBX_NAME)):
            return d
    raise FileNotFoundError('old lady model not found in ' + ' or '.join(SRC))


def _material(d, aov):
    """her texture through a plain principled shader, plus the AOVs post.py needs (aux 0: ordinary surface)"""
    name = 'oldlady_skin'
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = os.path.join(d, 'textures')
    def img(fn, data):
        for cand in (os.path.join(tex, fn), os.path.join(d, 'source', 'Textures', fn)):
            if os.path.exists(cand):
                im = bpy.data.images.load(cand, check_existing=True)
                if data:
                    im.colorspace_settings.name = 'Non-Color'
                n = nt.nodes.new('ShaderNodeTexImage'); n.image = im
                return n
        return None
    dif = img('Old_Lady_4_packed0_diffuse.png', False) or img('Old_Lady_New_packed0_diffuse.jpg', False)
    if dif:
        nt.links.new(dif.outputs['Color'], b.inputs['Base Color'])
    nrm = img('Old_Lady_New_packed0_normal.jpeg', True) or img('Old_Lady_New_packed0_normal.jpg', True)
    if nrm:
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8
        nt.links.new(nrm.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.78
    try:
        b.inputs['Subsurface Weight'].default_value = 0.08
        b.inputs['Specular IOR Level'].default_value = 0.3
    except KeyError:
        pass
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    aov(nt, out, (0, 0, 0))
    # the engraving is drawn on her, not on the air she moves through: her lines are read off where each point of her
    # stands at rest (an attribute kept on the mesh), so they go with her cloth and skin
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_type = 'GEOMETRY'; at.attribute_name = 'restp'
    nt.links.new(at.outputs['Vector'], nt.nodes['posorg'].inputs[0])
    return m


def _frame(z_down, x_hint):
    """rotation whose -Z runs along z_down and whose X is as close to x_hint as possible"""
    zc = -V(z_down).normalized()
    x = V(x_hint) - zc * V(x_hint).dot(zc)
    if x.length < 1e-6:
        x = V((0, 1, 0)) - zc * zc.y
    x.normalize()
    y = zc.cross(x)
    return Matrix((x, y, zc)).transposed()


def _driver_scale(dst, src, k):
    """dst.rotation_euler = src.rotation_euler * k, per axis (simple expressions: no Python needed in -b)"""
    for i in range(3):
        fc = dst.driver_add('rotation_euler', i)
        dr = fc.driver; dr.type = 'SCRIPTED'
        v = dr.variables.new(); v.name = 'r'; v.type = 'SINGLE_PROP'
        v.targets[0].id = src; v.targets[0].data_path = f'rotation_euler[{i}]'
        dr.expression = f'r*{k}'


def build(name, loc, seated, lib):
    """import the model and build the control skeleton. Returns (root, P) like lib.knitter."""
    d = _src()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(d, FBX_NAME), use_anim=False, ignore_leaf_bones=False)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    meshes = [o for o in new if o.type == 'MESH']
    for o in new:
        if o.users_collection and o.name not in bpy.context.scene.collection.objects:
            for c in o.users_collection:
                c.objects.unlink(o)
            bpy.context.scene.collection.objects.link(o)
    arm.name = name + '_ol_rig'
    arm.location = loc; arm.rotation_euler = (0, 0, 0); arm.scale = (0.01 * SCALE,) * 3
    mt = _material(d, lib._aov)
    for o in meshes:
        o.name = name + '_ol_' + o.name.replace(' ', '_')
        o.data.materials.clear(); o.data.materials.append(mt)
        for p in o.data.polygons:
            p.use_smooth = True
        if 'Tongue' in o.name or 'Teeth' in o.name:
            o.hide_render = True                     # behind closed lips; they only poke through when the jaw moves
    arm.hide_render = True
    bpy.context.view_layer.update()
    for o in meshes:
        rp = o.data.attributes.new('restp', 'FLOAT_VECTOR', 'POINT')
        mw = o.matrix_world
        rp.data.foreach_set('vector', [c for v in o.data.vertices for c in (mw @ v.co)])
    bpy.context.view_layer.update()
    Wr = {b.name: arm.matrix_world @ b.matrix_local for b in arm.data.bones}
    pos = {k: m.translation.copy() for k, m in Wr.items()}
    tail = {b.name: arm.matrix_world @ b.tail_local for b in arm.data.bones}

    # ── the control skeleton (desired world frames at bind) ──
    I3 = Matrix.Identity(3)
    ctl = {}            # name -> (object, parent name, world 4x4 at bind)

    def add(key, at, rot=I3, par=None):
        o = lib.empty(f'{name}_{key}')
        o.empty_display_size = 0.02
        ctl[key] = (o, par, Matrix.Translation(V(at)) @ rot.to_4x4())
        return o
    root = add('root', loc)
    root.name = name
    add('hips', pos['root.x'], par='root')
    add('spine', pos['spine_01.x'], par='hips')          # the input: shots set/key its rotation
    add('sp1', pos['spine_01.x'], par='hips')
    add('sp2', pos['spine_02.x'], par='sp1')
    add('sp3', pos['spine_03.x'], par='sp2')
    add('neck', pos['neck.x'], par='sp3')
    add('head', pos['head.x'], par='neck')
    for s, sd in ((1, 'l'), (-1, 'r')):
        # X up at bind for both sides: lowered to her sides, X then points outward, as lib.arm_to builds it. Her right
        # hand's frame is the hand-built one turned half round its length (see lib.hand_frame_flip)
        up = V((0, 0, 1))
        add(f'arm{s}', pos[f'arm_stretch.{sd}'], par='sp3')
        Rs = _frame(pos[f'forearm_stretch.{sd}'] - pos[f'arm_stretch.{sd}'], up)
        add(f'sh{s}', pos[f'arm_stretch.{sd}'], Rs, par=f'arm{s}')
        Rf = _frame(pos[f'hand.{sd}'] - pos[f'forearm_stretch.{sd}'], up)
        add(f'fore{s}', pos[f'forearm_stretch.{sd}'], Rf, par=f'sh{s}')
        add(f'hand{s}', pos[f'hand.{sd}'], Rf, par=f'fore{s}')
        for k, fn in enumerate(FINGERS):
            add(f'f{s}{k}a', pos[f'{fn}1.{sd}'], Rf, par=f'hand{s}')
            add(f'f{s}{k}b', pos[f'{fn}2.{sd}'], Rf, par=f'f{s}{k}a')
            add(f'f{s}{k}c', pos[f'{fn}3.{sd}'], Rf, par=f'f{s}{k}b')
            add(f'f{s}{k}end', tail[f'{fn}3.{sd}'], Rf, par=f'f{s}{k}c')
        add(f'th{s}a', pos[f'thumb1.{sd}'], Rf, par=f'hand{s}')
        add(f'th{s}b', pos[f'thumb2.{sd}'], Rf, par=f'th{s}a')
        add(f'th{s}c', pos[f'thumb3.{sd}'], Rf, par=f'th{s}b')
        add(f'th{s}end', tail[f'thumb3.{sd}'], Rf, par=f'th{s}c')
        add(f'thigh{s}', pos[f'thigh_stretch.{sd}'], par='hips')
        add(f'shin{s}', pos[f'leg_stretch.{sd}'], par=f'thigh{s}')
        add(f'foot{s}', pos[f'foot.{sd}'], par=f'shin{s}')
    # parent with identity inverse and local = parent^-1 @ world, so rotation_euler means "relative to the parent"
    for key, (o, par, Wd) in ctl.items():
        if par:
            o.parent = ctl[par][0]
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_basis = ctl[par][2].inverted() @ Wd
        else:
            o.matrix_basis = Wd
    bpy.context.view_layer.update()

    # ── every deforming bone follows a helper under its control ──
    follow = {'root.x': 'hips', 'spine_01.x': 'sp1', 'spine_02.x': 'sp2', 'spine_03.x': 'sp3', 'neck.x': 'neck', 'head.x': 'head'}
    for s, sd in ((1, 'l'), (-1, 'r')):
        follow.update({f'arm_stretch.{sd}': f'sh{s}', f'forearm_stretch.{sd}': f'fore{s}', f'hand.{sd}': f'hand{s}',
                       f'thigh_stretch.{sd}': f'thigh{s}', f'leg_stretch.{sd}': f'shin{s}', f'foot.{sd}': f'foot{s}',
                       f'thumb1.{sd}': f'th{s}a', f'thumb2.{sd}': f'th{s}b', f'thumb3.{sd}': f'th{s}c'})
        for k, fn in enumerate(FINGERS):
            follow.update({f'{fn}1.{sd}': f'f{s}{k}a', f'{fn}2.{sd}': f'f{s}{k}b', f'{fn}3.{sd}': f'f{s}{k}c'})
    for bn, ck in follow.items():
        if bn not in arm.pose.bones:
            continue
        c = ctl[ck][0]
        h = lib.empty(f'{name}_fol_{bn}')
        h.empty_display_size = 0.01
        h.parent = c; h.matrix_parent_inverse = Matrix.Identity(4)
        h.matrix_basis = ctl[ck][2].inverted() @ Wr[bn]
        con = arm.pose.bones[bn].constraints.new('COPY_TRANSFORMS')
        con.target = h; con.owner_space = 'WORLD'; con.target_space = 'WORLD'
    # spine bend shared over three bones; the last finger joints follow the middle ones
    sp = ctl['spine'][0]
    for key, k in (('sp1', 0.45), ('sp2', 0.3), ('sp3', 0.25)):
        _driver_scale(ctl[key][0], sp, k)
    for s in (1, -1):
        for k in range(4):
            _driver_scale(ctl[f'f{s}{k}c'][0], ctl[f'f{s}{k}b'][0], 0.75)
        _driver_scale(ctl[f'th{s}c'][0], ctl[f'th{s}b'][0], 0.8)

    # ── the parts dictionary the shots use ──
    O = {k: v[0] for k, v in ctl.items()}
    P = {'torso': O['spine'], 'head': O['head'], 'neck': O['neck'], 'hips': O['hips'], 'sp3': O['sp3'], 'rig': arm, 'meshes': meshes, 'oldlady': True,
         'L1': (pos['forearm_stretch.l'] - pos['arm_stretch.l']).length, 'L2': (pos['hand.l'] - pos['forearm_stretch.l']).length}
    for s in (1, -1):
        P[f'arm{s}'], P[f'sh{s}'], P[f'fore{s}'], P[f'hand{s}'] = O[f'arm{s}'], O[f'sh{s}'], O[f'fore{s}'], O[f'hand{s}']
        P[f'fingers{s}'] = [(O[f'f{s}{k}a'], O[f'f{s}{k}b'], O[f'f{s}{k}end']) for k in range(4)]
        P[f'thumb{s}'] = (O[f'th{s}a'], O[f'th{s}b'], O[f'th{s}end'])
        P[f'thigh{s}'], P[f'shin{s}'], P[f'foot{s}'] = O[f'thigh{s}'], O[f'shin{s}'], O[f'foot{s}']
    # ── her resting body: the stoop and the bent neck the hand-built knitter had; seated or standing legs ──
    O['spine'].rotation_euler = (0.3, 0, 0)
    O['neck'].rotation_euler = (0.22, 0, 0)
    if seated:
        sit(P)
    return root, P


def shawl(P, material, lib, name='knitter'):
    """a fringed knitted shawl over her shoulders (the model has none): the epilogue needs one to turn red.
    Built on her upper spine so it bends with her; open down the front."""
    top = lib._folded_frustum(name + '_shawltop', 0.075, 0.25, 0.125, -0.0, folds=7, depth=0.04, sx=1.0, sy=0.74, n=56, rings=6, material=material, seed=10, gap=(-math.pi / 2, 0.45))
    low = lib._folded_frustum(name + '_shawl', 0.25, 0.3, 0.0, -0.27, folds=9, depth=0.12, sx=1.0, sy=0.72, n=56, rings=12, material=material, seed=11, gap=(-math.pi / 2, 0.62))
    for o in (top, low):
        o.parent = P['sp3']; o.matrix_parent_inverse = Matrix.Identity(4)
        o.location = (0, -0.01, 0)
        so = o.modifiers.new('solid', 'SOLIDIFY'); so.thickness = 0.008; so.offset = 1.0
    return low


def sit(P, seat=0.48):
    """sitting on a seat `seat` high: the hips come down onto it, the thighs run forward (a little downhill so the
    shins reach the floor), the shins drop to the floor, the feet flat"""
    hips = P['hips']
    hip_h = seat + 0.075               # her hip joints sit this far above what she sits on
    hips.location.z = hip_h; hips.location.y += 0.03
    thigh = P['L1'] * 0 + 0.456 * SCALE
    shin = 0.472 * SCALE
    ankle = 0.076 * SCALE
    drop = max(0.0, min(0.95, (hip_h - (shin + ankle)) / thigh))
    a = math.asin(drop)                 # thigh angle below horizontal
    for s in (1, -1):
        P[f'thigh{s}'].rotation_euler = (-(math.pi / 2 - a), 0, s * 0.06)
        P[f'shin{s}'].rotation_euler = (math.pi / 2 - a - 0.08, 0, 0)
        P[f'foot{s}'].rotation_euler = (0.08, 0, 0)
