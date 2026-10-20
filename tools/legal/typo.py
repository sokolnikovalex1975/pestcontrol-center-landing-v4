import re
NB = '\u00a0'
SHORT = r'(?:в|во|без|до|из|к|ко|на|по|о|об|обо|от|с|со|у|за|для|и|а|но|или|не|ни|при|под|над|про)'
def _typo_text(s):
    s = s.replace(' —', NB + '—')
    s = re.sub(r'(?<![\w\-])(' + SHORT + r') (?=\S)', lambda m: m.group(1) + NB, s, flags=re.I)
    s = re.sub(r'(?<![\w])(ст|ч|п|пп|г|д|к|корп|лит|ул|помещ|стр|т|тел)\. (?=\S)', lambda m: m.group(1) + '.' + NB, s, flags=re.I)
    s = s.replace('№ ', '№' + NB)
    s = re.sub(r'(?<![\w])(ООО|АО|ИП) (?=«)', lambda m: m.group(1) + NB, s)
    s = re.sub(r'(?<=\d) (?=[а-яёА-ЯЁ])', NB, s)
    s = s.replace('+7 (495) 085-10-95', '+7' + NB + '(495)' + NB + '085-10-95')
    return s
def typo(html):
    parts = re.split(r'(<[^>]+>)', html)
    return ''.join(p if p.startswith('<') else _typo_text(p) for p in parts)
