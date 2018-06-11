const tap = require('tap');

const PanEffect = require('../../src/effects/PanEffect');
const PitchEffect = require('../../src/effects/PitchEffect');
const VolumeEffect = require('../../src/effects/VolumeEffect');

const AudioEngine = require('../__mocks__/AudioEngine');
const AudioTarget = require('../__mocks__/AudioTarget');

const testEffect = (EffectClass, effectDepth) => {
    tap.test(EffectClass.name, t1 => {
        t1.plan(3);

        t1.test('methods', t2 => {
            t2.plan(7);

            t2.ok(
                'DEFAULT_VALUE' in EffectClass.prototype,
                'has DEFAULT_VALUE'
            );
            t2.type(EffectClass.prototype.initialize, 'function', 'has initialize');
            t2.type(EffectClass.prototype.set, 'function', 'has set');
            t2.type(EffectClass.prototype.update, 'function', 'has update');
            t2.type(EffectClass.prototype.clear, 'function', 'has clear');
            t2.type(EffectClass.prototype.connect, 'function', 'has connect');
            t2.type(EffectClass.prototype.dispose, 'function', 'has dispose');

            t2.end();
        });

        t1.test('connect', t2 => {
            t2.plan(6);

            const engine = new AudioEngine();
            const target = new AudioTarget();
            let effect = new EffectClass(engine, target, null);

            target.inputNode._test('stall', 'message does not move');
            t2.equal(target.inputNode._result().depth, 0, 'message not sent');
            t2.ok(!engine.inputNode._result(), 'message not received');
            t2.ok(!engine.inputNode.connected, 'engine not connected');

            effect.dispose();
            effect = new EffectClass(engine, target, null);
            const effect2 = new EffectClass(engine, target, effect);
            effect2.connect(engine);
            effect.connect(effect2);

            target.inputNode._test('move', 'message does move');
            t2.ok(!target.inputNode._result(), 'message sent');
            t2.equal(engine.inputNode._result().depth, 1, 'message received');
            t2.ok(engine.inputNode.connectedFrom.length, 'engine connected');

            t2.end();
        });

        t1.test('lifecycle', t2 => {
            t2.plan(18);

            const engine = new AudioEngine();
            const target = new AudioTarget();
            let effect = new EffectClass(engine, target, null);
            let effect2 = new EffectClass(engine, target, effect);

            target.inputNode._test('stall', 'message does not move');
            t2.equal(target.inputNode._result().depth, 0, 'message not sent');
            t2.ok(!engine.inputNode._result(), 'message not received');
            t2.ok(!engine.inputNode.connected, 'engine not connected');

            effect2.connect(engine);
            effect.connect(effect2);

            target.inputNode._test('move', 'message does move');
            t2.ok(!target.inputNode._result(), 'message sent');
            t2.equal(engine.inputNode._result().depth, 1, 'message received');
            t2.ok(engine.inputNode.connectedFrom.length, 'engine connected');

            effect.set(effect.DEFAULT_VALUE - 1);

            target.inputNode._test('move', 'message does move');
            t2.ok(!target.inputNode._result(), 'message sent');
            t2.equal(engine.inputNode._result().depth, 1 + effectDepth, 'message received');
            t2.ok(engine.inputNode.connectedFrom.length, 'engine connected');

            effect2.set(effect2.DEFAULT_VALUE - 1);

            target.inputNode._test('move', 'message does move');
            t2.ok(!target.inputNode._result(), 'message sent');
            t2.equal(engine.inputNode._result().depth, 1 + (2 * effectDepth), 'message received');
            t2.ok(engine.inputNode.connectedFrom.length, 'engine connected');

            effect.clear();

            target.inputNode._test('move', 'message does move');
            t2.ok(!target.inputNode._result(), 'message sent');
            t2.equal(engine.inputNode._result().depth, 1 + effectDepth, 'message received');
            t2.ok(engine.inputNode.connectedFrom.length, 'engine connected');

            effect2.clear();

            target.inputNode._test('move', 'message does move');
            t2.ok(!target.inputNode._result(), 'message sent');
            t2.equal(engine.inputNode._result().depth, 1, 'message received');
            t2.ok(engine.inputNode.connectedFrom.length, 'engine connected');

            t2.end();
        });

        t1.end();
    });
};

testEffect(PanEffect, 3);
testEffect(PitchEffect, 0);
testEffect(VolumeEffect, 1);
