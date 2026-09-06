"""
Builds the HOKYZ skater + goalie meshes with a rigid-part armature and exports GLB.
Run headless (never inside a live session with unsaved work):
  blender -b -P assets/src/build_skater.py -- --out public/models
Conventions: Z-up in Blender, exported Y-up. Model faces +X (sim facing = 0).
Bones point along their local +Y (Blender convention). Skinning is rigid per part,
except the torso which blends hips->chest by height so the waist bends.
"""
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[argv.index('--out') + 1]) if '--out' in argv else os.path.abspath('public/models')
os.makedirs(OUT, exist_ok=True)

# ---------- helpers ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()

def mat(name, rgb, rough=0.6, metal=0.0, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

MATS = {}
def M(name, rgb, rough=0.6, metal=0.0):
    if name not in MATS:
        MATS[name] = mat(name, rgb, rough, metal)
    return MATS[name]

def box(name, center, size, bevel=0.03, seg=6, sub=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'NONE'
        bpy.ops.object.modifier_apply(modifier='Bevel')
    if sub > 0:
        s = o.modifiers.new('Sub', 'SUBSURF')
        s.levels = sub
        bpy.ops.object.modifier_apply(modifier='Sub')
    bpy.ops.object.shade_smooth()
    return o

def sphere(name, center, r, seg=40, rings=28, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    return o

def limb(name, a, b, r0, r1, verts=32):
    """Contoured padded limb with rounded ends and subtle cloth folds."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    axis = d.normalized()
    u = axis.cross(Vector((0, 0, 1)))
    if u.length < 0.01: u = axis.cross(Vector((0, 1, 0)))
    u.normalize(); v = axis.cross(u).normalized()
    points, faces = [], []
    rings = 13 if max(r0, r1) > 0.05 else 2
    for j in range(rings):
        t = j / (rings - 1)
        radius = r0 * (1-t) + r1 * t
        if rings > 2:
            radius *= 0.86 + 0.18 * math.sin(math.pi * t)
        for i in range(verts):
            angle = i * math.tau / verts
            fold = 1 + (0.025 * math.sin(t * 29 + angle * 3) * math.sin(math.pi*t) if rings > 2 else 0)
            p = a + d*t + (u*math.cos(angle) + v*math.sin(angle))*radius*fold
            points.append(tuple(p))
            if j > 0:
                k = j*verts+i; prev = j*verts+(i+1)%verts
                faces.append((k-verts, prev-verts, prev, k))
    faces.extend([tuple(reversed(range(verts))), tuple((rings-1)*verts+i for i in range(verts))])
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(points, [], faces); mesh.update()
    o = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(o)
    for p in mesh.polygons: p.use_smooth = len(p.vertices) == 4
    return o

def tube(name, points, radius=0.006):
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'
    curve.resolution_u = 12; curve.bevel_depth = radius; curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co; p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active = obj; bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def jersey_body(width, depth, lo, hi):
    """Ring-built tailored uniform: rounded shoulders, waist taper, loose hem."""
    points, faces = [], []
    count, rows = 64, 25
    for j in range(rows):
        t = j / (rows-1)
        w = width * (0.85 + 0.15*math.sin(t*math.pi*0.72))
        d = depth * (0.93 + 0.12*math.sin(t*math.pi))
        if t > 0.88: w *= 1 - (t-0.88)*2.8
        for i in range(count):
            a = i*math.tau/count
            # Low-amplitude folds change the silhouette rather than flat-shaded facets.
            fold = 1 + 0.028*math.sin(a*9+t*10)*(1-t) + 0.012*math.sin(t*35+a*3)
            points.append((math.cos(a)*d*fold, math.sin(a)*w*fold, lo+t*(hi-lo)))
            if j:
                k = j*count+i; n = j*count+(i+1)%count
                faces.append((k-count, n-count, n, k))
    faces.extend([tuple(reversed(range(count))), tuple((rows-1)*count+i for i in range(count))])
    mesh = bpy.data.meshes.new('tailoredJersey'); mesh.from_pydata(points, [], faces); mesh.update()
    obj = bpy.data.objects.new('torso', mesh); bpy.context.collection.objects.link(obj)
    for p in mesh.polygons: p.use_smooth = len(p.vertices) == 4
    return obj

def assign_mat(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)

def vgroup_all(o, bone, weight=1.0):
    vg = o.vertex_groups.new(name=bone)
    vg.add([v.index for v in o.data.vertices], weight, 'REPLACE')

def vgroup_blend_z(o, bone_lo, bone_hi, z0, z1):
    lo = o.vertex_groups.new(name=bone_lo)
    hi = o.vertex_groups.new(name=bone_hi)
    for v in o.data.vertices:
        z = (o.matrix_world @ v.co).z
        t = max(0.0, min(1.0, (z - z0) / (z1 - z0)))
        t = t * t * (3 - 2 * t)
        hi.add([v.index], t, 'REPLACE')
        lo.add([v.index], 1 - t, 'REPLACE')

def torso_uvs(o, y_half=0.32, z0=0.8, z1=1.42):
    """Front (+x) → u in [0.5,1], back (-x) → u in [0,0.5], sides → thin strips. v = height."""
    me = o.data
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            co = o.matrix_world @ me.vertices[me.loops[li].vertex_index].co
            v = (co.z - z0) / (z1 - z0)
            ty = (co.y + y_half) / (2 * y_half)
            if n.x > 0.4:
                u = 0.5 + (1 - ty) * 0.5
            elif n.x < -0.4:
                u = ty * 0.5
            else:
                # sides/top/bottom: sample near the seam of front region
                u = 0.5 + (0.02 if co.y > 0 else 0.48)
            uv.data[li].uv = (max(0, min(1, u)), max(0, min(1, v)))

def simple_uvs(o):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

def join(objs, name):
    for o in bpy.data.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    j = bpy.context.active_object
    j.name = name
    return j

# ---------- rig ----------
def build_armature(name, bones):
    """bones: list of (name, head, tail, parent)"""
    arm = bpy.data.armatures.new(name + 'Arm')
    ao = bpy.data.objects.new(name + 'Rig', arm)
    bpy.context.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for bn, head, tail, parent in bones:
        b = arm.edit_bones.new(bn)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = eb[parent]
        eb[bn] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return ao

def skin(mesh, rig):
    mesh.parent = rig
    mod = mesh.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig

# ---------- skater ----------
def build_skater(goalie=False):
    reset()
    parts = []
    jersey = M('jersey', (0.2, 0.4, 0.9), 0.75)
    sleeve = M('sleeve', (0.2, 0.4, 0.9), 0.75)
    pants = M('pants', (0.06, 0.06, 0.08), 0.8)
    socks = M('socks', (0.15, 0.15, 0.2), 0.8)
    gloves = M('gloves', (0.1, 0.1, 0.12), 0.7)
    helmet = M('helmet', (0.08, 0.08, 0.1), 0.35, 0.2)
    visor = M('visor', (0.38, 0.51, 0.58), 0.08, 0.05)
    visor.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = 0.28
    visor.surface_render_method = 'DITHERED'
    skin_m = M('skin', (0.85, 0.62, 0.5), 0.6)
    skate = M('skate', (0.1, 0.1, 0.12), 0.5)
    blade = M('blade', (0.8, 0.8, 0.85), 0.25, 0.9)
    stick_m = M('stick', (0.025, 0.032, 0.044), 0.32, 0.2)
    tape = M('tape', (0.05, 0.05, 0.05), 0.9)
    pad_m = M('pad', (0.93, 0.93, 0.95), 0.85)
    trim = M('trim', (0.78, 0.83, 0.88), 0.65)
    dark = M('rubber', (0.012, 0.019, 0.027), 0.8)
    eyes = M('eyes', (0.045, 0.055, 0.06), 0.25)

    def detail(obj, material, bone):
        assign_mat(obj, material); vgroup_all(obj, bone); parts.append(obj)
        return obj

    # Athletic anatomy under protective gear, rather than oversized block bodies.
    W = 0.275 if not goalie else 0.33
    D = 0.16 if not goalie else 0.19
    HIP_Z, CHEST_Z, NECK_Z = 0.85, 1.38, 1.44
    HEAD_Z = 1.6
    SHOULDER = (0.02, W + 0.02, 1.32)

    # pelvis + torso
    pelvis = box('pelvis', (0, 0, 0.84), (0.34, 0.5, 0.2), bevel=0.05, seg=4)
    assign_mat(pelvis, pants); vgroup_all(pelvis, 'hips'); parts.append(pelvis)
    torso = jersey_body(W, D, HIP_Z-0.035, CHEST_Z+0.035)
    assign_mat(torso, jersey); torso_uvs(torso, y_half=W); vgroup_blend_z(torso, 'hips', 'chest', HIP_Z + 0.05, CHEST_Z - 0.15); parts.append(torso)
    for s in (-1, 1):
        pad = sphere('shoulder%s' % s, (0.0, s * (W - 0.015), 1.32), 0.12, scale=(1.1, 1.0, 0.82))
        assign_mat(pad, sleeve); vgroup_all(pad, 'chest'); parts.append(pad)
    collar = [(0.085*math.cos(i*math.tau/32), 0.10*math.sin(i*math.tau/32), 1.407) for i in range(33)]
    detail(tube('collarBinding', collar, 0.014), dark, 'chest')
    detail(tube('collarStitch', [(x*1.13,y*1.13,z-0.012) for x,y,z in collar], 0.003), trim, 'chest')

    # head
    neck = limb('neck', (0, 0, NECK_Z - 0.03), (0, 0, HEAD_Z - 0.12), 0.07, 0.07)
    assign_mat(neck, skin_m); vgroup_all(neck, 'head'); parts.append(neck)
    face = sphere('face', (0.018, 0, HEAD_Z-0.015), 0.135, scale=(0.95, 0.85, 1.18))
    # Taper jaw/chin; cheeks and brow receive their own soft forms.
    for vertex in face.data.vertices:
        if vertex.co.z < -0.02:
            vertex.co.y *= 1 + vertex.co.z*1.8
    assign_mat(face, skin_m); vgroup_all(face, 'head'); parts.append(face)
    detail(sphere('nose', (0.147,0,HEAD_Z-0.022),0.027,scale=(1.05,0.65,1.35)), skin_m, 'head')
    detail(tube('mouth', [(0.135,-0.025,HEAD_Z-0.078),(0.145,0,HEAD_Z-0.081),(0.135,0.025,HEAD_Z-0.078)],0.003), M('lips',(0.40,0.20,0.16)), 'head')
    for s in (-1,1):
        detail(sphere('ear', (-0.006,s*0.117,HEAD_Z-0.027),0.03,scale=(0.75,0.42,1.3)),skin_m,'head')
        detail(sphere('cheek', (0.105,s*0.057,HEAD_Z-0.049),0.025,scale=(0.55,1.0,0.8)),skin_m,'head')
        detail(sphere('eye', (0.134,s*0.048,HEAD_Z+0.006),0.008,seg=24,rings=16,scale=(0.55,1.15,0.65)),eyes,'head')
        detail(tube('brow',[(0.129,s*0.027,HEAD_Z+0.028),(0.131,s*0.05,HEAD_Z+0.03),(0.12,s*0.07,HEAD_Z+0.024)],0.006),dark,'head')
        detail(tube('chinStrap', [(-0.02,s*0.142,HEAD_Z+0.01),(0.04,s*0.133,HEAD_Z-0.095),(0.097,s*0.057,HEAD_Z-0.148),(0.11,0,HEAD_Z-0.149)],0.009),dark,'head')
    helm = sphere('helmet', (-0.015, 0, HEAD_Z + 0.04), 0.158, seg=64, rings=40, scale=(1.08, 0.98, 0.96))
    # cut the helmet: remove faces below the brow
    bm = bmesh.new(); bm.from_mesh(helm.data)
    geom = [f for f in bm.faces if ((helm.matrix_world @ f.calc_center_median()).z < HEAD_Z - 0.03 and (helm.matrix_world @ f.calc_center_median()).x > -0.05) or ((helm.matrix_world @ f.calc_center_median()).z < HEAD_Z + 0.028 and (helm.matrix_world @ f.calc_center_median()).x > 0.075)]
    bmesh.ops.delete(bm, geom=geom, context='FACES')
    bm.to_mesh(helm.data); bm.free()
    bpy.context.view_layer.objects.active = helm
    solid = helm.modifiers.new('Shell thickness','SOLIDIFY'); solid.thickness=0.009
    bpy.ops.object.modifier_apply(modifier=solid.name)
    assign_mat(helm, helmet); vgroup_all(helm, 'head'); parts.append(helm)
    for s in (-1,1):
        for i in range(3):
            detail(box('helmetVent',(-0.07+i*0.055,s*0.137,HEAD_Z+0.072),(0.035,0.01,0.024),bevel=0.009),dark,'head')
        detail(tube('helmetRidge',[(-0.13,s*0.06,HEAD_Z+0.115),(-0.055,s*0.063,HEAD_Z+0.171),(0.04,s*0.061,HEAD_Z+0.165),(0.105,s*0.055,HEAD_Z+0.135)],0.005),helmet,'head')
        detail(sphere('visorScrew',(0.045,s*0.156,HEAD_Z+0.019),0.012,seg=20,rings=12,scale=(1,0.3,1)),blade,'head')
    if goalie:
        # mask shell (team-colored helmet material) wrapping the face, plus a bar cage and chin guard
        shell = sphere('maskshell', (0.03, 0, HEAD_Z - 0.01), 0.167, seg=64,rings=40, scale=(1.05, 1.02, 1.13))
        bm2 = bmesh.new(); bm2.from_mesh(shell.data)
        # cut the front opening for the cage
        geom2 = [f for f in bm2.faces if (shell.matrix_world @ f.calc_center_median()).x > 0.12 and abs((shell.matrix_world @ f.calc_center_median()).z - (HEAD_Z - 0.02)) < 0.12]
        bmesh.ops.delete(bm2, geom=geom2, context='FACES')
        bm2.to_mesh(shell.data); bm2.free()
        assign_mat(shell, helmet); vgroup_all(shell, 'head'); parts.append(shell)
        for i in range(3):
            bar = tube('cageh%d' % i, [(0.12,-0.135,HEAD_Z-0.1+i*0.07),(0.215,0,HEAD_Z-0.11+i*0.07),(0.12,0.135,HEAD_Z-0.1+i*0.07)],0.005)
            assign_mat(bar, blade); vgroup_all(bar, 'head'); parts.append(bar)
        for i in range(4):
            y = -0.12 + i * 0.08
            bar = tube('cagev%d' % i,[(0.12,y,HEAD_Z-0.15),(0.20,y,HEAD_Z-0.055),(0.16,y,HEAD_Z+0.08)],0.005)
            assign_mat(bar, blade); vgroup_all(bar, 'head'); parts.append(bar)
        chin = box('chin', (0.16, 0, HEAD_Z - 0.17), (0.08, 0.2, 0.06), bevel=0.02, seg=2)
        assign_mat(chin, pad_m); vgroup_all(chin, 'head'); parts.append(chin)
    else:
        # Curved transparent shield with visible eyes behind it.
        verts, faces = [], []
        for j in range(2):
            for i in range(33):
                a = -1.12+i/32*2.24
                verts.append((0.174*math.cos(a)+0.012,0.166*math.sin(a),HEAD_Z+0.05-j*0.082))
                if j and i: faces.append((i-1,i,33+i,32+i))
        me=bpy.data.meshes.new('visor'); me.from_pydata(verts,[],faces); me.update()
        vz=bpy.data.objects.new('visor',me); bpy.context.collection.objects.link(vz)
        for p in me.polygons: p.use_smooth=True
        assign_mat(vz, visor); vgroup_all(vz, 'head'); parts.append(vz)

    # arms: pre-posed holding the stick in front
    # stick grip points
    grip_top = Vector((0.28, 0.06, 0.95))
    grip_low = Vector((0.5, 0.3, 0.6)) if not goalie else Vector((0.45, 0.32, 0.62))
    hand_targets = {1: grip_top, -1: grip_low}   # +y = left side (top hand), -y = right (low hand)
    # left hand on top, right hand low  → left is +y in Blender for a +X facing model
    arm_len_u, arm_len_f = 0.3, 0.28
    bones = [('root', (0, 0, 0), (0, 0, 0.1), None),
             ('hips', (0, 0, HIP_Z), (0, 0, HIP_Z + 0.12), 'root'),
             ('spine', (0, 0, HIP_Z + 0.12), (0, 0, HIP_Z + 0.32), 'hips'),
             ('chest', (0, 0, HIP_Z + 0.32), (0, 0, CHEST_Z), 'spine'),
             ('neck', (0, 0, CHEST_Z), (0, 0, NECK_Z + 0.04), 'chest'),
             ('head', (0, 0, NECK_Z + 0.04), (0, 0, HEAD_Z + 0.2), 'neck')]
    for s, side in ((1, 'L'), (-1, 'R')):
        sh = Vector((SHOULDER[0], s * SHOULDER[1], SHOULDER[2]))
        target = hand_targets[s].copy()
        target.y = abs(target.y) * s if s > 0 else -abs(target.y)
        # two-bone IK in the plane defined by shoulder, target and an outward/back pole
        d = target - sh
        L = min(d.length, arm_len_u + arm_len_f - 0.01)
        cos_a = (arm_len_u ** 2 + L ** 2 - arm_len_f ** 2) / (2 * arm_len_u * L)
        a = math.acos(max(-1, min(1, cos_a)))
        dn = d.normalized()
        pole = Vector((-0.6, s * 1.0, -0.2)).normalized()
        perp = (pole - dn * pole.dot(dn)).normalized()
        elbow = sh + (dn * math.cos(a) + perp * math.sin(a)) * arm_len_u
        hand = sh + dn * L
        ua = limb('upperArm%s' % side, sh, elbow, 0.085, 0.07)
        assign_mat(ua, sleeve); vgroup_all(ua, 'upperArm.' + side); parts.append(ua)
        fa = limb('foreArm%s' % side, elbow, hand, 0.07, 0.06)
        assign_mat(fa, sleeve); vgroup_all(fa, 'foreArm.' + side); parts.append(fa)
        detail(sphere('elbowFold',elbow,0.071,seg=32,rings=20),sleeve,'foreArm.'+side)
        hdir = (hand - elbow).normalized()
        if goalie and side == 'R':
            gl = box('blocker', hand + hdir * 0.05, (0.08, 0.28, 0.32), bevel=0.03)
            assign_mat(gl, pad_m)
        elif goalie and side == 'L':
            gl = sphere('catcher', hand + hdir * 0.06, 0.15, scale=(0.6, 1.0, 1.0))
            assign_mat(gl, pad_m)
        else:
            gl = box('glove%s' % side, hand + hdir * 0.05, (0.16, 0.14, 0.13), bevel=0.045, seg=8)
            assign_mat(gl, gloves)
            for finger in range(4):
                detail(box('fingerPadding',hand+hdir*0.055+Vector((0.075,(finger-1.5)*0.03,0)),(0.035,0.025,0.105),bevel=0.012),gloves,'hand.'+side)
            detail(sphere('thumb',hand+Vector((0.04,-s*0.078,-0.025)),0.037,scale=(1,0.7,1.4)),gloves,'hand.'+side)
        detail(limb('gloveCuff',hand-hdir*0.038,hand+hdir*0.007,0.083,0.085),gloves,'hand.'+side)
        vgroup_all(gl, 'hand.' + side); parts.append(gl)
        bones += [('shoulder.' + side, (0, s * 0.1, 1.32), tuple(sh), 'chest'),
                  ('upperArm.' + side, tuple(sh), tuple(elbow), 'shoulder.' + side),
                  ('foreArm.' + side, tuple(elbow), tuple(hand), 'upperArm.' + side),
                  ('hand.' + side, tuple(hand), tuple(hand + hdir * 0.12), 'foreArm.' + side)]

    # legs
    for s, side in ((1, 'L'), (-1, 'R')):
        hip = Vector((0, s * 0.13, HIP_Z - 0.02))
        knee = Vector((0.04, s * 0.15, 0.45))
        ankle = Vector((0.0, s * 0.16, 0.1))
        th = limb('thigh%s' % side, hip, knee, 0.12, 0.095)
        assign_mat(th, pants); vgroup_all(th, 'thigh.' + side); parts.append(th)
        sh_ = limb('shin%s' % side, knee, ankle, 0.085, 0.07)
        assign_mat(sh_, socks); vgroup_all(sh_, 'shin.' + side); parts.append(sh_)
        for stripe_z in (0.31,0.36):
            stripe_a=ankle.lerp(knee,(stripe_z-0.1)/0.35)
            detail(limb('sockStripe',stripe_a,stripe_a+Vector((0,0,0.023)),0.086,0.087),sleeve,'shin.'+side)
        if goalie:
            lp = box('legpad%s' % side, (0.07, s * 0.17, 0.38), (0.2, 0.28, 0.6), bevel=0.07, seg=4)
            assign_mat(lp, pad_m); vgroup_all(lp, 'shin.' + side); parts.append(lp)
            kp = box('kneepad%s' % side, (0.06, s * 0.17, 0.62), (0.18, 0.26, 0.22), bevel=0.06, seg=3)
            assign_mat(kp, pad_m); vgroup_all(kp, 'thigh.' + side); parts.append(kp)
            for pad_z in (0.19,0.30,0.41,0.52):
                detail(tube('padSeam',[(0.164,s*0.17-0.10,pad_z),(0.173,s*0.17,pad_z-0.006),(0.164,s*0.17+0.10,pad_z)],0.004),trim,'shin.'+side)
            detail(box('padAccent',(0.174,s*0.17+s*0.077,0.37),(0.008,0.018,0.43),bevel=0.006),sleeve,'shin.'+side)
        boot = box('boot%s' % side, (0.05, s * 0.16, 0.1), (0.3, 0.14, 0.17), bevel=0.055, seg=8)
        assign_mat(boot, skate); vgroup_all(boot, 'foot.' + side); parts.append(boot)
        detail(sphere('ankleSupport',(-0.035,s*0.16,0.17),0.081,scale=(0.82,0.88,1.18)),skate,'foot.'+side)
        detail(box('toeCap',(0.15,s*0.16,0.096),(0.115,0.146,0.12),bevel=0.047),dark,'foot.'+side)
        for lace in range(5):
            lx=-0.012+lace*0.023
            detail(tube('lace',[(lx,s*0.16-0.04,0.177),(lx+0.014,s*0.16+0.04,0.177)],0.003),trim,'foot.'+side)
        for support_x in (-0.045,0.145):
            detail(box('bladeHolder',(support_x,s*0.16,0.04),(0.045,0.035,0.052),bevel=0.009),trim,'foot.'+side)
        bl = box('blade%s' % side, (0.05, s * 0.16, 0.012), (0.3, 0.02, 0.025), bevel=0.0)
        assign_mat(bl, blade); vgroup_all(bl, 'foot.' + side); parts.append(bl)
        bones += [('thigh.' + side, tuple(hip), tuple(knee), 'hips'),
                  ('shin.' + side, tuple(knee), tuple(ankle), 'thigh.' + side),
                  ('foot.' + side, tuple(ankle), (0.2, s * 0.16, 0.05), 'shin.' + side)]

    # stick
    top = grip_top + Vector((-0.06, 0.02, 0.08))
    heel = Vector((0.86, 0.45, 0.02)) if not goalie else Vector((0.75, 0.42, 0.02))
    shaft = limb('shaft', top, heel, 0.013, 0.013, verts=24)
    assign_mat(shaft, stick_m); vgroup_all(shaft, 'stick'); parts.append(shaft)
    bdir = Vector((1, 0.35, 0)).normalized()
    if goalie:
        paddle = limb('paddle', heel + Vector((-0.3, -0.12, 0.28)), heel, 0.035, 0.035, verts=8)
        assign_mat(paddle, stick_m); vgroup_all(paddle, 'stick'); parts.append(paddle)
    bladeo = box('stickblade', (0,0,0), (0.34, 0.045, 0.065), bevel=0.012, seg=6)
    rotation = Matrix.Rotation(math.atan2(bdir.y, bdir.x), 4, 'Z')
    for vertex in bladeo.data.vertices:
        vertex.co = rotation @ vertex.co + heel + bdir*0.15 + Vector((0,0,0.013))
    assign_mat(bladeo, tape); vgroup_all(bladeo, 'stick'); parts.append(bladeo)
    bones += [('stick', tuple(top), tuple(heel), 'hand.R')]

    rig = build_armature('goalie' if goalie else 'skater', bones)
    mesh = join(parts, 'goalieMesh' if goalie else 'skaterMesh')
    # ensure every material slot survives the join with correct indices (join keeps them)
    skin(mesh, rig)
    for o in bpy.data.objects:
        o.select_set(True)
    name = 'goalie' if goalie else 'skater'
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_skins=True, export_animations=False, export_materials='EXPORT',
                              use_selection=True, export_texcoords=True, export_normals=True)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print('EXPORTED', path, 'tris', tris, 'bones', len(bones))

build_skater(goalie=False)
build_skater(goalie=True)
