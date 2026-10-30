#!/usr/bin/env python3
"""Parse docs/azentio-site-content.md into app/(config)/content/pages.json."""
import json, re, sys

src = open('docs/azentio-site-content.md', encoding='utf-8').read()
start = src.index('\n# Pages')
chunks = re.split(r'\n---\n', src[start:])
pages = []
for chunk in chunks:
    m = re.search(r'^## (.+)\n\s*\nURL: https://www\.azentio\.com(\S*)', chunk, re.M)
    if not m:
        continue
    meta_title, path = m.group(1).strip(), m.group(2).strip() or '/'
    desc = re.search(r'^Meta description: (.+)$', chunk, re.M)
    body = chunk[m.end():]
    body = re.sub(r'^Meta description:.*$', '', body, flags=re.M)
    body = re.sub(r'_\(Shared blocks repeated.*?\)_', '', body, flags=re.S)
    title = None
    intro = []
    crumbs = []
    sections = []
    cur = None
    card = None
    for raw in body.split('\n'):
        line = raw.strip()
        if not line:
            continue
        if line.startswith('### ') and title is None:
            title = line[4:].strip()
            continue
        if line.startswith('#### ') or (line.startswith('### ') and title):
            cur = {'heading': line.lstrip('# ').strip(), 'text': [], 'cards': []}
            sections.append(cur); card = None
            continue
        if line.startswith('##### ') or line.startswith('###### '):
            card = {'title': line.lstrip('# ').strip(), 'text': ''}
            if cur is None:
                cur = {'heading': '', 'text': [], 'cards': []}
                sections.append(cur)
            cur['cards'].append(card)
            continue
        if line.startswith('- ') and cur is None:
            crumbs.append(line[2:].strip()); continue
        if line.startswith('- '):
            (cur['text'] if cur else intro).append('• ' + line[2:].strip()); continue
        if card is not None and cur is not None and not card['text']:
            card['text'] = line; continue
        if cur is None:
            intro.append(line)
        else:
            cur['text'].append(line); card = None
    pages.append({'path': path, 'metaTitle': meta_title,
                  'description': desc.group(1).strip() if desc else '',
                  'title': title or meta_title, 'intro': intro, 'breadcrumbs': crumbs,
                  'sections': sections})

json.dump(pages, open('app/(config)/content/pages.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(pages), 'pages')
