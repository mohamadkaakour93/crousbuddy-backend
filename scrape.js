const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');

async function scrapeWebsite() {

    try {
        // this is the link for logements in montpellier
        const { data } = await axios.get('https://trouverunlogement.lescrous.fr/tools/36/search?bounds=3.8070597_43.6533542_3.9413208_43.5667088');
        const $ = cheerio.load(data);
        
        // Check if any elements with the class "fr-card" exist 
        const numberOfLogements = $('.fr-card').length
        const frCardExists =  numberOfLogements > 0;
        const aucunLogementTrouve = $('body').text().includes('Aucun logement trouvé');

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        if (frCardExists) {
            await sendEmail(`${numberOfLogements}`);
        } else if (aucunLogementTrouve) {
            console.log('Pas de logement');
            console.log(`Current time: ${hours}:${minutes}:${seconds}`);
        } else {
            console.log('Attention your script is not running correctly')
            console.log(`Current time: ${hours}:${minutes}:${seconds}`);
        }
    } catch (error) {
        console.error(`Error scraping website: ${error}`);
    }
}

async function sendEmail(scrapedData) {
    let transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'bilelkihalscript@gmail.com',
            pass: 'hefx qthb wrzb vtrz'
        }
    });

    let info = await transporter.sendMail({
        from: '"Logement" <contact@crous.fr>',
        to: 'bilel.kihal.2007@gmail.com, is_laouici@esi.dz',
        subject: 'Logement trouvé',
        text: `Nous avans trouver ${scrapedData} logements`,
    });

    console.log('Email sent: ' + info.response);
}

// to be executed each 3 seconds
setInterval(scrapeWebsite, 3000);
