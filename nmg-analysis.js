exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    var body = JSON.parse(event.body);
    var prompt = body.prompt;
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'No prompt' }) };

    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 25000);

    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        system: 'Esti un specialist NMG. Raspunde DOAR in limba romana. Foloseste DOAR caractere ASCII simple: cratima (-) in loc de linie de pauza, ghilimele drepte ("") in loc de cele cursive, apostrofe drepte (\') in loc de cele cursive. Nu folosi caractere speciale unicode precum \u2014 \u2013 \u2018 \u2019 \u201c \u201d \u2026. Scrie clar si profesional. IMPORTANT: Nu recomanda niciodata nimic la final — nici consultatii, nici specialisti, nici produse, nici servicii. Opreste-te strict la analiza NMG solicitata. Nu adauga nicio sectiune de recomandari, concluzii sau pasi urmatori dupa analiza.'
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    var data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return {
        statusCode: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'API error: ' + (data.error && data.error.message || response.status) })
      };
    }

    var text = data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';

    // Sanitize unicode characters that render incorrectly in HTML
    text = text
      .replace(/\u2014/g, ' - ')
      .replace(/\u2013/g, ' - ')
      .replace(/\u2018|\u2019/g, "'")
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ text: text })
    };

  } catch(err) {
    console.error('NMG function error:', err.message, err.stack);
    return {
      statusCode: err.name === 'AbortError' ? 504 : 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: err.name === 'AbortError' ? 'Timeout - incearca din nou' : err.message 
      })
    };
  }
};
