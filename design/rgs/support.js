(function () {
  'use strict';

  window.DCLogic = class {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }

    setState(patch) {
      Object.assign(this.state, patch);
      if (this.__render) this.__render();
    }
  };

  const HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const SINGLE = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/;

  function lookup(scopes, path) {
    const parts = path.split('.');
    for (let i = scopes.length - 1; i >= 0; i -= 1) {
      if (scopes[i] && parts[0] in scopes[i]) {
        let v = scopes[i][parts[0]];
        for (let j = 1; j < parts.length && v != null; j += 1) v = v[parts[j]];
        return v;
      }
    }
    return undefined;
  }

  function fill(text, scopes) {
    return text.replace(HOLE, (_, p) => {
      const v = lookup(scopes, p);
      return v == null ? '' : String(v);
    });
  }

  function renderNodes(nodes, scopes, out) {
    nodes.forEach((n) => renderNode(n, scopes, out));
  }

  function renderNode(node, scopes, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(fill(node.nodeValue, scopes)));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'template' && node.dataset.sc === 'for') {
      const m = SINGLE.exec(node.getAttribute('list') || '');
      const list = m ? lookup(scopes, m[1]) : [];
      const as = node.getAttribute('as') || 'item';
      (list || []).forEach((item, i) => {
        renderNodes([...node.content.childNodes], scopes.concat([{ [as]: item, $index: i }]), out);
      });
      return;
    }
    if (tag === 'template' && node.dataset.sc === 'if') {
      const m = SINGLE.exec(node.getAttribute('value') || '');
      if (m && lookup(scopes, m[1])) renderNodes([...node.content.childNodes], scopes, out);
      return;
    }
    const el = document.createElementNS(node.namespaceURI, node.localName);
    for (const a of node.attributes) {
      const m = SINGLE.exec(a.value);
      const name = a.name.toLowerCase();
      if (name.startsWith('on') && m) {
        const fn = lookup(scopes, m[1]);
        if (typeof fn === 'function') {
          el.addEventListener(name === 'onchange' ? 'input' : name.slice(2), fn);
        }
        continue;
      }
      const val = fill(a.value, scopes);
      if (name === 'value' && tag === 'input') el.value = val;
      el.setAttribute(a.name, val);
    }
    const kids = tag === 'template' ? [...node.content.childNodes] : [...node.childNodes];
    renderNodes(kids, scopes, el);
    out.appendChild(el);
  }

  function toTemplates(src) {
    return src
      .replace(/<sc-for\b/g, '<template data-sc="for"')
      .replace(/<\/sc-for>/g, '</template>')
      .replace(/<sc-if\b/g, '<template data-sc="if"')
      .replace(/<\/sc-if>/g, '</template>');
  }

  async function boot() {
    let src;
    try {
      src = await (await fetch(location.href)).text();
    } catch (e) {
      document.body.textContent = 'Откройте через http-сервер: python -m http.server';
      return;
    }
    const a = src.indexOf('<x-dc>');
    const b = src.indexOf('</x-dc>');
    const doc = new DOMParser().parseFromString(
      '<body>' + toTemplates(src.slice(a + 6, b)) + '</body>', 'text/html');
    const helmet = doc.querySelector('helmet');
    if (helmet) {
      [...helmet.children].forEach((c) => document.head.appendChild(c.cloneNode(true)));
      helmet.remove();
    }
    const script = document.querySelector('script[data-dc-script]');
    const Component = new Function(script.textContent + '\nreturn Component;')();
    const comp = new Component({});
    const root = document.createElement('div');
    document.querySelector('x-dc').replaceWith(root);
    const tpl = [...doc.body.childNodes];
    comp.__render = () => {
      const frag = document.createDocumentFragment();
      renderNodes(tpl, [comp.renderVals()], frag);
      root.replaceChildren(frag);
    };
    comp.__render();
    document.documentElement.dataset.ready = '1';
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
