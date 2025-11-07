const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = 'data.json';
const CONFIG_FILE = 'config.json';

let writeLock = false;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    const rawData = fs.readFileSync(CONFIG_FILE);
    return JSON.parse(rawData);
  }
  return {
    users: {
      grilli: null,
      masa: null
    }
  };
}

async function saveConfig(config) {
  while (writeLock) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  writeLock = true;
  try {
    const tempFile = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(config, null, 2));
    fs.renameSync(tempFile, CONFIG_FILE);
  } finally {
    writeLock = false;
  }
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const rawData = fs.readFileSync(DATA_FILE);
    return JSON.parse(rawData);
  }
  return {
    grilli: { bought: [], sold: [], inventory: 0 },
    masa: { bought: [], sold: [], inventory: 0 }
  };
}

async function saveData(data) {
  while (writeLock) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  writeLock = true;
  try {
    const tempFile = DATA_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, DATA_FILE);
  } finally {
    writeLock = false;
  }
}

function getUserKeyById(userId) {
  const config = loadConfig();
  if (config.users.grilli === userId) return 'grilli';
  if (config.users.masa === userId) return 'masa';
  return null;
}

function parseAmount(input) {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '');
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)(?:bgl)?$/);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return null;
}

function parsePrice(input) {
  const normalized = input.trim().replace(/\s+/g, '');
  const match = normalized.match(/^([+-])?\s*(\d+(?:[.,]\d+)?)\s*€?$/);
  if (match) {
    const price = parseFloat(match[2].replace(',', '.'));
    return match[1] === '-' ? -price : price;
  }
  return null;
}

const commands = [
  {
    name: 'setup',
    description: 'Rekisteröi itsesi käyttäjäksi (Grilli tai Masa)',
    options: [
      {
        name: 'user',
        description: 'Valitse käyttäjä',
        type: 3,
        required: true,
        choices: [
          { name: 'Grilli', value: 'grilli' },
          { name: 'Masa', value: 'masa' }
        ]
      }
    ]
  },
  {
    name: 'bought',
    description: 'Kirjaa BGL:ien osto',
    options: [
      {
        name: 'amount',
        description: 'Määrä (esim. 10bgl tai 10)',
        type: 3,
        required: true
      },
      {
        name: 'price',
        description: 'Hinta (esim. -25€, 25€ tai 25)',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'sold',
    description: 'Kirjaa BGL:ien myynti',
    options: [
      {
        name: 'amount',
        description: 'Määrä (esim. 10bgl tai 10)',
        type: 3,
        required: true
      },
      {
        name: 'price',
        description: 'Hinta (esim. +35€, 35€ tai 35)',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'stats',
    description: 'Näytä kaupankäynti tilastot'
  }
];

client.once('ready', async () => {
  console.log(`✅ Botti kirjautunut sisään nimellä ${client.user.tag}`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  
  try {
    console.log('🔄 Rekisteröidään slash-komennot...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash-komennot rekisteröity!');
  } catch (error) {
    console.error('❌ Virhe slash-komentojen rekisteröinnissä:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setup') {
    const selectedUser = interaction.options.getString('user');
    const config = loadConfig();
    
    if (config.users[selectedUser] && config.users[selectedUser] !== interaction.user.id) {
      await interaction.reply({
        content: `❌ ${selectedUser.toUpperCase()} on jo rekisteröity toiselle käyttäjälle.`,
        ephemeral: true
      });
      return;
    }
    
    const otherUser = selectedUser === 'grilli' ? 'masa' : 'grilli';
    if (config.users[otherUser] === interaction.user.id) {
      config.users[otherUser] = null;
    }
    
    config.users[selectedUser] = interaction.user.id;
    await saveConfig(config);
    
    await interaction.reply({
      content: `✅ Olet nyt rekisteröity käyttäjänä **${selectedUser.toUpperCase()}**!`,
      ephemeral: true
    });
    return;
  }

  const userKey = getUserKeyById(interaction.user.id);
  
  if (!userKey && interaction.commandName !== 'stats') {
    await interaction.reply({
      content: '❌ Et ole rekisteröitynyt. Käytä ensin `/setup` komentoa valitaksesi Grilli tai Masa.',
      ephemeral: true
    });
    return;
  }

  const data = loadData();

  if (interaction.commandName === 'bought') {
    const amountInput = interaction.options.getString('amount');
    const priceInput = interaction.options.getString('price');

    const amount = parseAmount(amountInput);
    const price = parsePrice(priceInput);

    if (amount === null) {
      await interaction.reply({
        content: '❌ Virheellinen määrä. Käytä muotoa: 10bgl, 10 bgl tai 10',
        ephemeral: true
      });
      return;
    }

    if (price === null) {
      await interaction.reply({
        content: '❌ Virheellinen hinta. Käytä muotoa: -25€, -25, 25€ tai 25',
        ephemeral: true
      });
      return;
    }

    const actualPrice = price < 0 ? price : -price;

    data[userKey].bought.push({
      amount: amount,
      price: actualPrice,
      timestamp: new Date().toISOString()
    });
    data[userKey].inventory += amount;

    await saveData(data);

    await interaction.reply({
      content: `✅ **${userKey.toUpperCase()}** osti **${amount} BGL** hintaan **${actualPrice}€**\n💼 Varasto: **${data[userKey].inventory} BGL**`,
      ephemeral: false
    });
  }

  else if (interaction.commandName === 'sold') {
    const amountInput = interaction.options.getString('amount');
    const priceInput = interaction.options.getString('price');

    const amount = parseAmount(amountInput);
    const price = parsePrice(priceInput);

    if (amount === null) {
      await interaction.reply({
        content: '❌ Virheellinen määrä. Käytä muotoa: 10bgl, 10 bgl tai 10',
        ephemeral: true
      });
      return;
    }

    if (price === null) {
      await interaction.reply({
        content: '❌ Virheellinen hinta. Käytä muotoa: +35€, +35, 35€ tai 35',
        ephemeral: true
      });
      return;
    }

    const actualPrice = price > 0 ? price : -price;

    if (data[userKey].inventory < amount) {
      await interaction.reply({
        content: `⚠️ Varastossa on vain **${data[userKey].inventory} BGL**. Et voi myydä **${amount} BGL**.`,
        ephemeral: true
      });
      return;
    }

    data[userKey].sold.push({
      amount: amount,
      price: actualPrice,
      timestamp: new Date().toISOString()
    });
    data[userKey].inventory -= amount;

    await saveData(data);

    await interaction.reply({
      content: `✅ **${userKey.toUpperCase()}** myi **${amount} BGL** hintaan **+${actualPrice}€**\n💼 Varasto: **${data[userKey].inventory} BGL**`,
      ephemeral: false
    });
  }

  else if (interaction.commandName === 'stats') {
    const totalInventory = data.grilli.inventory + data.masa.inventory;

    const grilliTotalBought = data.grilli.bought.reduce((sum, t) => sum + t.price, 0);
    const grilliTotalSold = data.grilli.sold.reduce((sum, t) => sum + t.price, 0);
    const grilliProfit = grilliTotalSold + grilliTotalBought;

    const masaTotalBought = data.masa.bought.reduce((sum, t) => sum + t.price, 0);
    const masaTotalSold = data.masa.sold.reduce((sum, t) => sum + t.price, 0);
    const masaProfit = masaTotalSold + masaTotalBought;

    const totalProfit = grilliProfit + masaProfit;
    const profitPerPerson = totalProfit / 2;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('📊 BGL Kaupankäynti Tilastot')
      .addFields(
        { 
          name: '💼 Varasto', 
          value: `**${totalInventory} BGL**\n🔸 Grilli: ${data.grilli.inventory} BGL\n🔸 Masa: ${data.masa.inventory} BGL`, 
          inline: false 
        },
        { 
          name: '🔻 GRILLI', 
          value: `Ostot: ${grilliTotalBought.toFixed(2)}€\nMyynnit: +${grilliTotalSold.toFixed(2)}€\nVoitto: **${grilliProfit.toFixed(2)}€**`, 
          inline: true 
        },
        { 
          name: '🔻 MASA', 
          value: `Ostot: ${masaTotalBought.toFixed(2)}€\nMyynnit: +${masaTotalSold.toFixed(2)}€\nVoitto: **${masaProfit.toFixed(2)}€**`, 
          inline: true 
        },
        { 
          name: '💰 Yhteensä', 
          value: `Kokonaisvoitto: **${totalProfit.toFixed(2)}€**\nPuoliksi jaettuna: **${profitPerPerson.toFixed(2)}€** / henkilö`, 
          inline: false 
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN ei löydy ympäristömuuttujista!');
  process.exit(1);
}

client.login(token);
