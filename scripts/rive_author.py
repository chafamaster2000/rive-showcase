#!/usr/bin/env python3
"""Author a piece of the showcase in the Rive editor, over its MCP.

The editor exports only a file's **first** artboard, so every piece is built on
the artboard the file already has, one at a time. And a View Model created this
way does not reach the export until the file is reopened, even though shapes and
timelines do. So the loop is, per piece:

    python3 scripts/rive_author.py button        # draw it
    # reopen the file in the editor (Cmd+R): view models need it
    python3 scripts/rive_author.py export public/rive/button.riv
    python3 scripts/rive_author.py verify public/rive/button.riv hover pressed

`verify` is not optional: an export whose view model is missing still renders,
it just answers to nobody.

Scale and opacity formulas must produce units (1 + n), not percentages: a data
bind writes the raw value, so 100 + n lands as a 100x scale.
"""
import base64
import json
import os
import sys
import urllib.request

URL = 'http://127.0.0.1:9791/mcp'
SESSION = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.rive-session')


def _post(payload, session=None):
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Accept', 'application/json, text/event-stream')
    if session:
        req.add_header('Mcp-Session-Id', session)
    with urllib.request.urlopen(req, timeout=180) as r:
        sid = r.headers.get('Mcp-Session-Id')
        body = r.read().decode()
        ctype = r.headers.get('Content-Type', '')
    if 'text/event-stream' in ctype:
        msgs = [json.loads(l[5:].strip()) for l in body.splitlines() if l.startswith('data:')]
        return sid, (msgs[-1] if msgs else None)
    return sid, (json.loads(body) if body.strip() else None)


def _init():
    sid, _ = _post({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                               "clientInfo": {"name": "rive-author", "version": "1"}}})
    if sid:
        open(SESSION, 'w').write(sid)
    _post({"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    return sid


def call(tool, args, _retry=True):
    sid = open(SESSION).read().strip() if os.path.exists(SESSION) else _init()
    try:
        _, res = _post({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                        "params": {"name": tool, "arguments": args}}, sid)
    except urllib.error.HTTPError as e:
        if _retry and e.code in (400, 404):
            _init()
            return call(tool, args, False)
        raise
    if not res or 'result' not in res:
        raise SystemExit('%s failed: %s' % (tool, json.dumps(res)[:400]))
    text = res['result']['content'][0]['text']
    if res['result'].get('isError'):
        raise SystemExit('%s: %s' % (tool, text[:400]))
    try:
        return json.loads(text)
    except ValueError:
        return {'text': text}


# Property keys the editor uses for the transforms we animate.
X, Y, ROT, SX, SY, OPACITY, COLOR = 13, 14, 15, 16, 17, 18, 37
DURATION, LOOP = 57, 59            # on a linear animation; loop: 0 one-shot, 1 loop
BLEND, FLAGS, EXIT_TIME = 158, 152, 160   # on a transition; FLAGS 4 = use exit time


def artboard(name, w, h):
    """Rename and resize the file's first artboard, and return its id."""
    board = call('list_artboards', {})['artboards'][0]
    call('rename_objects', {"renames": [{"id": board['id'], "name": name}]})
    call('open_file_editor', {"command": "resizeArtboard",
                              "data": {"resizeArtboard": [{"artboardId": board['id'], "width": w, "height": h}]}})
    return board['id']


def shapes(items):
    made = call('path_editor', {"command": "createParametricShapes",
                                "data": {"createParametricShapes": {"shapes": items}}})['shapes']
    return {s['name']: s['id'] for s in made}


def view_model(name, properties, artboard_id):
    vm = call('viewmodel_editor', {"command": "createViewModels",
                                   "data": {"createViewModels": {"viewModels": [
                                       {"name": name, "viewModelProperties": properties}]}}})['viewModels'][0]
    call('viewmodel_editor', {"command": "bindViewModelToArtboard",
                              "data": {"bindViewModelToArtboard": {"artboardId": artboard_id, "viewModelId": vm['id']}}})
    return vm['id'], {p['name']: p['id'] for p in vm['viewModelProperties']}


def animations(names):
    existing = call('animation_editor', {"command": "listLinearAnimations", "data": {"listLinearAnimations": {}}})
    first = existing['linearAnimations'][0]
    call('animation_editor', {"command": "renameAnimations",
                              "data": {"renameAnimations": {"animations": [{"animationId": first['id'], "name": names[0]}]}}})
    out = {names[0]: first['id']}
    if len(names) > 1:
        made = call('animation_editor', {"command": "createLinearAnimations", "data": {"createLinearAnimations": {
            "linearAnimations": [{"name": n, "duration": 1} for n in names[1:]]}}})['animations']
        out.update({a['name']: a['id'] for a in made})
    return out


def keys(animation_id, frames):
    call('animation_editor', {"command": "modifyKeyFrames",
                              "data": {"modifyKeyFrames": {"animationId": animation_id, "add": frames}}})


def verify(path, names):
    """A .riv keeps its view model property names, so a missing one is visible
    in the bytes. Cheaper than loading the runtime to find out."""
    data = open(path, 'rb').read()
    missing = [n for n in names if n.encode() not in data]
    print('%s  %d bytes' % (path, len(data)))
    for n in names:
        print('  %-12s %s' % (n, 'ok' if n.encode() in data else 'MISSING'))
    if missing:
        raise SystemExit('reopen the file in the editor and export again')


def export(path):
    res = call('export_file', {"format": "riv", "destination": os.path.dirname(os.path.abspath(path)),
                               "inline_base64": True})
    if 'data' not in res:
        raise SystemExit('the editor wrote it itself: %s' % res)
    open(path, 'wb').write(base64.b64decode(res['data']))
    print('%s  %d bytes' % (path, os.path.getsize(path)))


def build_button():
    """Button: 220x64. React writes label, hover, pressed, loading and fires done."""
    board = artboard('Button', 220, 64)
    ids = shapes([
        {"primitive": "rectangle", "name": "Body", "x": 110, "y": 32, "width": 220, "height": 64,
         "cornerRadius": 18, "paints": [{"paintType": "fill", "color": "#fff5c542"}]},
        {"primitive": "ellipse", "name": "Spinner", "x": 110, "y": 32, "width": 26, "height": 26,
         "paints": [{"paintType": "fill", "color": "#ff1b1b28"}]},
    ])
    vm, props = view_model('Button', [
        {"name": "label", "propertyType": "string"},
        {"name": "hover", "propertyType": "boolean"},
        {"name": "pressed", "propertyType": "boolean"},
        {"name": "loading", "propertyType": "boolean"},
        {"name": "done", "propertyType": "trigger"},
    ], board)
    anims = animations(['Rest', 'Hover', 'Press', 'Loading', 'Done'])
    keys(anims['Rest'], [{"objectId": ids['Body'], "propertyKey": SY, "frame": 0, "value": 100},
                         {"objectId": ids['Spinner'], "propertyKey": OPACITY, "frame": 0, "value": 0}])
    keys(anims['Hover'], [{"objectId": ids['Body'], "propertyKey": SY, "frame": 0, "value": 106},
                          {"objectId": ids['Body'], "propertyKey": SX, "frame": 0, "value": 102}])
    keys(anims['Press'], [{"objectId": ids['Body'], "propertyKey": SY, "frame": 0, "value": 92},
                          {"objectId": ids['Body'], "propertyKey": SX, "frame": 0, "value": 98}])
    keys(anims['Loading'], [{"objectId": ids['Spinner'], "propertyKey": OPACITY, "frame": 0, "value": 100},
                            {"objectId": ids['Spinner'], "propertyKey": ROT, "frame": 0, "value": 0},
                            {"objectId": ids['Spinner'], "propertyKey": ROT, "frame": 40, "value": 360}])
    keys(anims['Done'], [{"objectId": ids['Body'], "propertyKey": SX, "frame": 0, "value": 100},
                         {"objectId": ids['Body'], "propertyKey": SX, "frame": 8, "value": 108,
                          "interpolationType": "elastic", "elasticParams": {"easing": 1, "amplitude": 1, "period": 0.6}},
                         {"objectId": ids['Body'], "propertyKey": SX, "frame": 30, "value": 100}])
    call('set_property_values', {"propertyValues": {
        anims['Loading']: {LOOP: 1, DURATION: 40}, anims['Done']: {LOOP: 0, DURATION: 30},
        anims['Rest']: {LOOP: 1}, anims['Hover']: {LOOP: 1}, anims['Press']: {LOOP: 1}}})
    print('button drawn. Reopen the file in Rive, then: rive_author.py export public/rive/button.riv')
    print('view model properties:', json.dumps(props))


def build_loader():
    """Loader: 160x160. React writes progress 0..100."""
    board = artboard('Loader', 160, 160)
    ids = shapes([
        {"primitive": "ellipse", "name": "Ring", "x": 80, "y": 80, "width": 128, "height": 128,
         "paints": [{"paintType": "stroke", "color": "#ff2a2a3c", "thickness": 12}]},
        {"primitive": "ellipse", "name": "Arc", "x": 80, "y": 80, "width": 128, "height": 128,
         "paints": [{"paintType": "stroke", "color": "#ff7cf0c9", "thickness": 12}]},
    ])
    vm, props = view_model('Loader', [
        {"name": "progress", "propertyType": "number"},
        {"name": "done", "propertyType": "boolean"},
    ], board)
    anims = animations(['Fill'])
    keys(anims['Fill'], [{"objectId": ids['Arc'], "propertyKey": ROT, "frame": 0, "value": -90},
                         {"objectId": ids['Arc'], "propertyKey": SX, "frame": 0, "value": 20},
                         {"objectId": ids['Arc'], "propertyKey": SX, "frame": 100, "value": 100}])
    call('set_property_values', {"propertyValues": {anims['Fill']: {LOOP: 0, DURATION: 100}}})
    print('loader drawn. Add a trim path on the Arc stroke by hand for a true arc,')
    print('then reopen the file and: rive_author.py export public/rive/loader.riv')
    print('view model properties:', json.dumps(props))


BUILDERS = {'button': build_button, 'loader': build_loader}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    if sys.argv[1] == 'export':
        export(sys.argv[2])
    elif sys.argv[1] == 'verify':
        verify(sys.argv[2], sys.argv[3:])
    elif sys.argv[1] in BUILDERS:
        BUILDERS[sys.argv[1]]()
    else:
        raise SystemExit('unknown piece: %s (%s)' % (sys.argv[1], ', '.join(BUILDERS)))
