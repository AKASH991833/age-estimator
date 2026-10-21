module.exports.run = async (page, base, shot) => {
  const out = [];
  await page.waitForFunction(() => document.querySelector('#st-model').textContent === '3 nets ready', {timeout: 120000});
  out.push(['3 models loaded (detector+landmarks+age/gender)', true]);
  await page.waitForFunction(() => document.querySelector('#st-ms').textContent !== '-', {timeout: 90000});
  const faces = await page.$eval('#st-faces', e => +e.textContent);
  out.push(['lena sample faces: ' + faces, faces >= 1]);
  const age = await page.$eval('.age-big', e => e.textContent);
  out.push(['age estimate shown: "' + age + '"', /~\d+/.test(age)]);
  const gender = await page.$eval('.frow .meta b', e => e.textContent);
  out.push(['gender label: "' + gender.trim() + '"', /(male|female)\s+\d+%/.test(gender.trim())]);
  const avg = await page.$eval('#st-avg', e => e.textContent);
  out.push(['mean age stat: ' + avg, /\d+/.test(avg)]);
  const histRows = await page.$$eval('#hist .hrow', r => r.length);
  out.push(['age histogram buckets: ' + histRows, histRows === 7]);
  // second sample
  await page.click('#sample2');
  await page.waitForFunction(() => document.querySelector('#st-ms').textContent !== '-', {timeout: 60000});
  await new Promise(r=>setTimeout(r,3000));
  const f2 = await page.$eval('#st-faces', e => +e.textContent);
  out.push(['two-people sample faces: ' + f2, f2 >= 2]);
  const range = await page.$eval('#st-range', e => e.textContent);
  out.push(['age span: ' + range, /\d+-\d+/.test(range)]);
  if (shot) await page.screenshot({path: shot});
  return out;
};
