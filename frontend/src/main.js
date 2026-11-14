import playlist from './data/playlist.json';

const app = document.querySelector('#app');
const list = document.createElement('ul');
for (const item of playlist) {
  const li = document.createElement('li');
  li.textContent = `${item.title} (${item.theme})`;
  list.append(li);
}
app.append(list);
console.log(`Playlist cargada: ${playlist.length} piezas`);
