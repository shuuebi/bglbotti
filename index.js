const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const DATA_FILE = 'data.json';
const CONFIG_FILE = 'config.json';
let writeLock = false;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ====== Helper Functions ======
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE));
  return { users: {} };
}

async function saveConfig(config) {
  while (writeLock) await new Promise(resolve => setTimeout(resolve, 10));
  writeLock = true;
  try {
    fs.writeFileSync(CONFIG_FILE + '.tmp', JSON.stringify(config, null, 2));
    fs.renameSync(CONFIG_FILE + '.tmp', CONFIG_FILE);
  } finally {
    writeLock = false;
  }
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE));
  return { inventory: 0, users: {} };
}

async function saveData(data) {
  while (writeLock) await new Promise(resolve => setTimeout(resolve, 10));
  writeLock = true;
  try {
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } finally {
    writeLock = false;
  }
}

function parseAmount(input) {
  const match = input.toLowerCase().replace(/\s+/g, '').match(/^(\d+(?:[.,]\d+)?)bgl?$/) || input.match(/^(\d+(?:[.,]\d+)?)$/);
  if (match) return parseFloat(match[1].replace(',', '.'));
  return null;
}

function parsePrice(input) {
  const match = input.trim().replace(/\s+/g, '').match(/^([+-])?(\d+(?:[.,]\d+)?)€?$/);
  if (match) {
    const sign = match[1];
    const price = parseFloat(match[2].replace(',', '.'));
    return sign === '-' ? -price : price;
  }
  return null;
}

// ====== Commands ======
const commands = [
  {
    name: 'setup',
    description: 'Aseta oma käyttäjänimi',
    options: [{ name: 'name', description: 'Kirjoita haluamasi nimi', type: 3, required: true }],
  },
  {
    name: 'bought',
    description: 'Kirjaa BGL ostot',
    options: [
      { name: 'amount', description: 'Määrä (esim. 10bgl)', type: 3, required: true },
      { name: 'price', description: 'Hinta (esim. 25€)', type: 3, required: true },
      {
        name: 'payment',
        description: 'Maksutapa',
        type: 3,
        required: true,
        choices: [
          { name: 'Crypto', value: 'crypto' },
          { name: 'PayPal', value: 'paypal' },
          { name: 'MobilePay', value: 'mobilepay' },
        ],
      },
    ],
  },
  {
    name: 'sold',
    description: 'Kirjaa BGL myynnit',
    options: [
      { name: 'amount', description: 'Määrä (esim. 10bgl)', type: 3, required: true },
      { name: 'price', description: 'Hinta (esim. 35€)', type: 3, required: true },
      {
        name: 'payment',
        description: 'Maksutapa',
        type: 3,
        required: true,
        choices: [
          { name: 'Crypto', value: 'crypto' },
          { name: 'PayPal', value: 'paypal' },
          { name: 'MobilePay', value: 'mobilepay' },
        ],
      },
    ],
  },
  { name: 'stats', description: 'Näytä kokonaisstatistiikat' },
  { name: 'personal', description: 'Näytä omat ostot/myynnit' },
  {
    name: 'reset',
    description: 'Nollaa kaikki tilastot',
    options: [{ name: 'confirm', description: 'Kirjoita RESET vahvistaaksesi', type: 3, required: true }],
  },
  { name: 'help', description: 'Näytä kaikki komennot' },
];

// ====== Ready ======
client.once('ready', async () => {
  console.log(`✅ Botti kirjautunut sisään nimellä ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash-komennot rekisteröity!');
  } catch (err) {
    console.error('Virhe komennon rekisteröinnissä:', err);
  }
});

// ====== Command Handling ======
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const data = loadData();
  const config = loadConfig();
  const userId = interaction.user.id;
  let userName = config.users[userId] || interaction.user.username;

  // ===== SETUP =====
  if (interaction.commandName === 'setup') {
    const newName = interaction.options.getString('name');
    config.users[userId] = newName;
    await saveConfig(config);
    return interaction.reply(`✅ Olet nyt asetettu nimeksi **${newName}**`);
  }

  // ===== BOUGHT =====
  if (interaction.commandName === 'bought') {
    const amount = parseAmount(interaction.options.getString('amount'));
    let price = parsePrice(interaction.options.getString('price'));
    const payment = interaction.options.getString('payment');

    if (amount === null || price === null) return interaction.reply('❌ Virheellinen määrä tai hinta');
    price = -Math.abs(price); // ostot aina negatiivisia

    data.inventory += amount;
    if (!data.users[userId]) data.users[userId] = { bought: [], sold: [] };
    data.users[userId].bought.push({ amount, price, payment, timestamp: new Date().toISOString() });
    await saveData(data);

    return interaction.reply(`✅ <@${userId}> osti **${amount} BGL** hintaan **${Math.abs(price)}€** (${payment})`);
  }

  // ===== SOLD =====
  if (interaction.commandName === 'sold') {
    const amount = parseAmount(interaction.options.getString('amount'));
    const price = parsePrice(interaction.options.getString('price'));
    const payment = interaction.options.getString('payment');

    if (amount === null || price === null) return interaction.reply('❌ Virheellinen määrä tai hinta');
    if (data.inventory < amount) return interaction.reply(`⚠️ Varastossa on vain **${data.inventory} BGL**`);

    data.inventory -= amount;
    if (!data.users[userId]) data.users[userId] = { bought: [], sold: [] };
    data.users[userId].sold.push({ amount, price: Math.abs(price), payment, timestamp: new Date().toISOString() });
    await saveData(data);

    return interaction.reply(`✅ <@${userId}> myi **${amount} BGL** hintaan **${price}€** (${payment})`);
  }

  // ===== STATS =====
  if (interaction.commandName === 'stats') {
    let totalBought = 0,
      totalSold = 0;
    const paymentMethods = { crypto: 0, paypal: 0, mobilepay: 0 };
    const paymentAmounts = {
      crypto: { soldAmount: 0, soldMoney: 0 },
      paypal: { soldAmount: 0, soldMoney: 0 },
      mobilepay: { soldAmount: 0, soldMoney: 0 },
    };

    for (const u of Object.values(data.users || {})) {
      u.bought?.forEach((t) => {
        totalBought += t.price;
        paymentMethods[t.payment] += t.price;
      });
      u.sold?.forEach((t) => {
        totalSold += t.price;
        paymentMethods[t.payment] += t.price;
        paymentAmounts[t.payment].soldAmount += t.amount;
        paymentAmounts[t.payment].soldMoney += t.price;
      });
    }

    const profit = totalSold + totalBought;
    const halfProfit = profit / 2;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('📊 Pinkkakriisiapuri tässä hei, alhaalla löydätte tilastonne :) :')
      .addFields(
        { name: '💼 Varasto', value: `**${data.inventory} BGL**`, inline: false },
        {
          name: '💰 Yhteensä',
          value: `Ostot: ${Math.abs(totalBought).toFixed(2)}€\nMyynnit: +${totalSold.toFixed(
            2
          )}€\nVoitto: ${profit.toFixed(2)}€\nPuoliksi jaettuna: ${halfProfit.toFixed(2)}€ / henkilö`,
          inline: false,
        },
        {
          name: '💳 Maksutavat - Crypto',
          value: `Raha: ${paymentMethods.crypto.toFixed(2)}€\nMyyty: ${
            paymentAmounts.crypto.soldAmount
          } BGL (${paymentAmounts.crypto.soldMoney.toFixed(2)}€)`,
          inline: true,
        },
        {
          name: '💳 Maksutavat - PayPal',
          value: `Raha: ${paymentMethods.paypal.toFixed(2)}€\nMyyty: ${
            paymentAmounts.paypal.soldAmount
          } BGL (${paymentAmounts.paypal.soldMoney.toFixed(2)}€)`,
          inline: true,
        },
        {
          name: '💳 Maksutavat - MobilePay',
          value: `Raha: ${paymentMethods.mobilepay.toFixed(2)}€\nMyyty: ${
            paymentAmounts.mobilepay.soldAmount
          } BGL (${paymentAmounts.mobilepay.soldMoney.toFixed(2)}€)`,
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== PERSONAL =====
  if (interaction.commandName === 'personal') {
    if (!data.users[userId]) return interaction.reply('❌ Sinulla ei vielä tietoja');
    const u = data.users[userId];
    const boughtTotal = u.bought.reduce((a, t) => a + t.price, 0);
    const soldTotal = u.sold.reduce((a, t) => a + t.price, 0);
    const profit = soldTotal + boughtTotal;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`📊 ${userName} Tilastot`)
      .addFields(
        { name: 'Ostot', value: `${Math.abs(boughtTotal).toFixed(2)}€`, inline: true },
        { name: 'Myynnit', value: `+${soldTotal.toFixed(2)}€`, inline: true },
        { name: 'Voitto', value: `${profit.toFixed(2)}€`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== RESET =====
  if (interaction.commandName === 'reset') {
    const confirmation = interaction.options.getString('confirm');
    if (confirmation !== 'RESET') return interaction.reply('❌ Kirjoita täsmälleen RESET vahvistaaksesi');
    const fresh = { inventory: 0, users: {} };
    await saveData(fresh);
    return interaction.reply('✅ Kaikki tilastot nollattu!');
  }

  // ===== HELP =====
  if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x00ffff)
      .setTitle('🛠️ BGL Bot Komennot')
      .setDescription(
        '/setup [nimi] - aseta oma nimi\n/bought [määrä] [hinta] [maksutapa] - kirjaa ostot\n/sold [määrä] [hinta] [maksutapa] - kirjaa myynnit\n/stats - näytä kokonaisstatistiikat\n/personal - näytä omat ostot/myynnit\n/reset [RESET] - nollaa tilastot\n/help - näytä tämä viesti'
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
});

// ====== Login ======
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN puuttuu');
  process.exit(1);
}
client.login(token);
