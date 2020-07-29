# Usual noise

Generally speaking, noises are unwanted content in versions. At the moment we found three types of noise.

### Irrelevant content

The first type of noise we try to remove is content that is not **relevant legally speaking**, and that harms **document readability**. 

**CSS selectors** are a first step as they permit to select an area instead of the whole page, but they let pass through content such as headers, footers, buttons, drop-down lists... 

**Filtering** permits to get rid of the remaining irrelevant content. 

#### Example :
A drop-down list let user select which document he would like to see but this list doesn't interest us in the final document.

**HTML file :**
```html
<div class="filter-holder">
  <select class="filter-options">
      <option value="https://www.redditinc.com/policies/user-agreement" selected>User Agreement</option>
      <option value="https://www.redditinc.com/policies/privacy-policy">Privacy Policy</option>
      <option value="https://www.redditinc.com/policies/content-policy">Content Policy</option>
      <option value="https://www.redditinc.com/policies/broadcasting-content-policy">Broadcasting Content Policy</option>
  </select>
</div>
<h1>Reddit User Agreement</h1>
```
**Markdown file :**
```
User Agreement Privacy Policy Content Policy Broadcasting Content Policy Moderator Guidelines Transparency Report 2017 Transparency Report 2018 Guidelines for Law Enforcement Transparency Report 2019

Reddit User Agreement
=====================
```
**Wished Markdown file :**
```

Reddit User Agreement
=====================
```
**Filter in Javascript :**
```javascript
export function removeOptionsList(document) {
  document.querySelectorAll('.filter-holder').forEach(element => element.remove());
}
```

### Invisible HTML elements

The second type of noise we try to remove are **elements invisible in the original HTML page** that **become visible in Markdown** or that **disrupt Markdown rendering**.

- **Invisible elements that become visible in Markdown** are usually hidden in the original page via CSS stylesheets.

#### Example :
An invisible paragraph (with display:none style) visible in the Markdown.

**HTML file :**
```html
<h1>Twitter Terms of Service</h1>
<p style="display: none;">goglobalwithtwitterbanner</p>
```
**Markdown file :**
```
Twitter Terms of Service
========================
goglobalwithtwitterbanner
```
**Wished Markdown file :**
```
Twitter Terms of Service
========================
```
**Filter in Javascript :**
```javascript
export function removeNotDisplayedElements(document) {
  document.querySelectorAll('[style="display: none;"]').forEach(element => element.remove());
}
```

- **Invisible elements that disrupt Markdown rendering** usually do so by being taken into account by HTML to Markdown conversion, whereas they were not in the original page.

#### Example : 
Invisible links disrupts numbering. 

**HTML file :**
```html
<h2>AGREEMENT</h2>
<ol>
  <a id="1"></a>
  <li>
    <span>Eligibility</span>
  </li>
  <div class="divider"></div>
  <a id="2"></a>
  <li>
    <span>Term, Terms and Termination</span>
  <li>
</ol>
```
**Markdown file :**
```
AGREEMENT
---------

2.  Eligibility
    
5.  Term, Terms and Termination
```
**Wished Markdown file :**
```
AGREEMENT
---------

1.  Eligibility
    
2.  Term, Terms and Termination
```
**Filter in Javascript :**
```javascript
export function numberListCorrectly(document) {
  document.querySelectorAll('ol')
    .forEach(listToClean => Array.from(listToClean.children)
      .filter(element => element.tagName != 'LI')
      .map(element => element.remove()));
}
```

### Content generating frequent and legally irrelevant changes

The third type of noise we try to remove is **content whose changes are both too frequent and legally irrelevant**. 
We found that those contents are usually hypertext links, since two links can point to the same website yet they can be written differently. A case in point are links passing parameters : a change in parameters will not change where the link point at.

#### Example : 
A link has a parameter 'h=' changing too frequently and irrelevant to the adress the link point to.

**HTML file :**
```html
You can only use our copyrights or <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fen.facebookbrand.com%2Ftrademarks%2F&amp;h=AT0_izDHO3yJuXJuJJeWQyJFVilQqIDOA3oMwr51t6gEq1q4UbyH2VtU7UhNzhg1LH0YzUHAjw0TADuoufWgb_YEuzoFpvyIR8_4rkUfjDXxUw3q1KmpsYL_H3C4OIm3xHzrUZRatmWQ6PAk">trademarks (or any similar marks)</a>
```
**Markdown file :**
```
You can only use our copyrights or [trademarks (or any similar marks)](https://l.facebook.com/l.php?u=https%3A%2F%2Fen.facebookbrand.com%2Ftrademarks%2F&h=AT1XEFWtw25SbFSSD7W2MOS1LQIsUwaUrq4qh5dNmI21qm42JE5lUiv9g8MsTSnvi3DjYfJxOPoBxEKyBQjo7qkxfcUkDzedQzBLWgGJYWC6CwDBI0S5pefB4oiuh8Jo63phreoUKQ3BF4O5)
```
**Wished Markdown file :**
```
You can only use our copyrights or [trademarks (or any similar marks)](https://l.facebook.com/l.php?u=https%3A%2F%2Fen.facebookbrand.com%2Ftrademarks%2F)
```
**Filter in Javascript :**
```javascript
export function cleanUrls(document) {
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"]');
  links.forEach(link => {
    link.href = link.href.replace(/&h=\S*/, '');
  });
}
```