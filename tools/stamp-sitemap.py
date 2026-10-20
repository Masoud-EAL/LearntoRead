#!/usr/bin/env python3
"""Set each sitemap <lastmod> to the date its page last changed in git.

Run by the deploy workflow just before the site is uploaded, so the published
sitemap never carries a stale hand-typed date. Bing leans on lastmod to decide
what to recrawl; a date that never moves reads as a page that never changes.

    python3 tools/stamp-sitemap.py            # rewrite sitemap.xml in place
    python3 tools/stamp-sitemap.py --files    # print the page file per URL

Needs full history (actions/checkout with fetch-depth: 0).
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://wordlink.au'


def page_file(loc):
    """https://wordlink.au/ -> index.html, /about.html -> about.html, /clock -> clock.html."""
    path = loc[len(SITE):].lstrip('/')
    if not path:
        return 'index.html'
    return path if path.endswith('.html') else path + '.html'


def last_changed(path):
    out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return out.strip()


def main():
    sitemap = os.path.join(ROOT, 'sitemap.xml')
    with open(sitemap, encoding='utf-8') as f:
        xml = f.read()

    if '--files' in sys.argv:
        for loc in re.findall(r'<loc>([^<]+)</loc>', xml):
            print(loc, page_file(loc))
        return

    def stamp(m):
        loc = m.group(2)
        date = last_changed(page_file(loc))
        if not date:
            return m.group(0)
        body = re.sub(r'\s*<lastmod>[^<]*</lastmod>', '', m.group(3))
        return '%s<loc>%s</loc>\n    <lastmod>%s</lastmod>%s' % (m.group(1), loc, date, body)

    xml = re.sub(r'(<url>\s*)<loc>([^<]+)</loc>(.*?)(?=</url>)', stamp, xml, flags=re.S)
    with open(sitemap, 'w', encoding='utf-8') as f:
        f.write(xml)


if __name__ == '__main__':
    main()
