# BGL Trading Bot - Discord Botti

## Yleiskuvaus
Discord-botti BGL-kaupankäynnin seurantaan. Botti seuraa Grillin ja Masan BGL-ostoja ja myyntejä, laskee voitot automaattisesti ja näyttää kaikki tilastot yhdessä paneelissa.

## Ominaisuudet
- `/setup` - Rekisteröi itsesi käyttäjäksi (Grilli tai Masa)
- `/bought` - Kirjaa BGL-ostot ja lisää varastoon
- `/sold` - Kirjaa BGL-myynnit, vähentää varastosta ja laskee voiton
- `/stats` - Näyttää kaikki tilastot yhdessä paneelissa (varasto, ostot, myynnit, voitot)
- `/reset` - Nollaa kaikki tilastot (vaatii vahvistuksen)
- Turvallinen käyttäjätunnistus Discord user ID:n perusteella
- Joustava syöttömuoto (hyväksyy "10bgl", "10 bgl", "10", "-25€", "-25", jne.)
- Voitot jaetaan puoliksi Grillin ja Masan välillä
- Tiedot tallennetaan turvallisesti atomisilla kirjoitusoperaatioilla

## Tekninen Rakenne
- **Backend**: Node.js 20
- **Framework**: Discord.js 14
- **Tietojen tallennus**: JSON (data.json)
- **Ympäristömuuttujat**: DISCORD_BOT_TOKEN (Replit Secrets)

## Käyttöönotto-ohjeet

### 1. Discord Botin Luominen
1. Mene [Discord Developer Portal](https://discord.com/developers/applications) -sivulle
2. Luo uusi sovellus (New Application)
3. Anna sovellukselle nimi (esim. "BGL Trading Bot")

### 2. Botin Konfigurointi
1. Mene **Bot** -välilehdelle
2. Paina **Add Bot** (jos ei vielä luotu)
3. Paina **Reset Token** ja kopioi token turvalliseen paikkaan
4. Varmista että **MESSAGE CONTENT INTENT** on päällä (Bot Settings)

### 3. Botin Kutsuminen Discord-palvelimelle
1. Mene **OAuth2** > **URL Generator** -välilehdelle
2. Valitse **Scopes**:
   - `bot`
   - `applications.commands`
3. Valitse **Bot Permissions**:
   - `Send Messages`
   - `Use Slash Commands`
   - `Embed Links`
4. Kopioi generoitu URL ja avaa se selaimessa
5. Valitse palvelin, jolle haluat botin lisätä
6. Hyväksy oikeudet

### 4. Botin Käynnistäminen Replitissä
Botti on jo konfiguroitu ja käynnissä Replitissä! Workflow "Discord Bot" pyörittää bottia automaattisesti.

## Käyttö

### 1. Rekisteröityminen
**TÄRKEÄÄ:** Ennen kuin voit käyttää bottia, sinun täytyy rekisteröityä käyttäjäksi:
```
/setup user:Grilli
```
tai
```
/setup user:Masa
```
Botti muistaa sinut Discord user ID:si perusteella, joten voit vaihtaa käyttäjänimesi ilman ongelmia.

### 2. Ostojen Kirjaaminen
Botti hyväksyy useita eri formaatteja ja vaatii maksutavan valinnan:
```
/bought amount:10bgl price:-25€ payment:crypto
/bought amount:10 bgl price:-25 payment:paypal
/bought amount:10 price:25 payment:mobilepay
```
Maksutavat: **Crypto**, **PayPal**, **MobilePay**

### 3. Myyntien Kirjaaminen
Sama joustavuus myös myynneissä, maksutapa pakollinen:
```
/sold amount:10bgl price:+35€ payment:crypto
/sold amount:10 bgl price:35€ payment:paypal
/sold amount:10 price:35 payment:mobilepay
```

### 4. Tilastojen Tarkastelu
```
/stats
```
Näyttää koko tilastopaneelin:
- Kokonaisvarasto (Grilli + Masa)
- Grillin ostot, myynnit ja voitto
- Masan ostot, myynnit ja voitto
- Yhteisvoitto ja puoliksi jaettu voitto per henkilö
- **Maksutapojen erittely**: Paljon rahaa ja myyty kullakin maksutavalla (Crypto, PayPal, MobilePay)

### 5. Tilastojen Nollaaminen
```
/reset confirm:RESET
```
**VAROITUS:** Tämä poistaa kaikki ostot, myynnit ja varastotiedot!
- Vain rekisteröityneet käyttäjät (Grilli tai Masa) voivat käyttää tätä komentoa
- Vahvistukseksi täytyy kirjoittaa täsmälleen `RESET`
- Käyttäjien rekisteröinnit säilyvät ennallaan

## Käyttäjätunnistus
Botti tunnistaa käyttäjät turvallisesti Discord user ID:n perusteella:
- Käytä `/setup` komentoa rekisteröityäksesi Grilliksi tai Masaksi
- Voit vaihtaa Discord-käyttäjänimesi milloin tahansa ilman ongelmia
- Vain rekisteröityneet käyttäjät voivat käyttää `/bought` ja `/sold` komentoja
- Jos vaihdat käyttäjää (esim. Grilli → Masa), vanha rekisteröinti poistetaan automaattisesti

## Tietojen Tallennus
Kaikki kaupat tallennetaan `data.json` tiedostoon seuraavassa muodossa:
```json
{
  "grilli": {
    "bought": [...],
    "sold": [...],
    "inventory": 10
  },
  "masa": {
    "bought": [...],
    "sold": [...],
    "inventory": 5
  }
}
```

## Viimeisimmät Muutokset
- 7.11.2024: Projekti luotu
- Discord.js 14 integraatio
- Slash-komennot (/setup, /bought, /sold, /stats, /reset)
- User ID -pohjainen tunnistus (turvallinen ja luotettava)
- Joustava syöttömuoto (hyväksyy eri formaatteja)
- Atominen tietojen tallennus lukituksella (estää tiedostojen korruptoitumisen)
- JSON-tietojen tallennus
- Voittojen jako puoliksi
- Maksutapojen seuranta (Crypto, PayPal, MobilePay)
- /reset komento tilastojen nollaamiseen (vaatii vahvistuksen)

## Jatkokehitysideat
- `/history` komento kaikkien kauppojen näyttämiseen aikajärjestyksessä
- Päivittäiset/viikottaiset raportit automaattisesti
- Graafiset kaaviot voitoista
- Tietokannan varmuuskopiointi
