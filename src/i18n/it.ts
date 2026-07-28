/**
 * Italian UI copy. This is the reference dictionary: `en.ts` is typed against
 * it, so adding a key here without translating it is a build error.
 *
 * Only interface strings live here. Event and community content stays in the
 * language its organisers published it in — translating it automatically would
 * misrepresent what they wrote.
 */
export const it = {
  // --- Site chrome ---
  'site.name': 'catania.community',
  'site.tagline': 'Agenda delle community di Catania e provincia',
  'site.skipToContent': 'Salta al contenuto',
  'site.themeLabel': 'Tema del sito',
  'site.themeLight': 'Chiaro',
  'site.themeDark': 'Scuro',
  'site.sections': 'Sezioni',
  'site.languageLabel': 'Lingua',

  'nav.events': 'Eventi',
  'nav.communities': 'Community',
  'nav.addCommunity': 'Aggiungi la tua community',

  'footer.about':
    'Agenda delle community di Catania e provincia. Facciamo da specchio: iscrizioni e biglietti restano sulle piattaforme di chi organizza.',
  'footer.openFormats': 'Formati aperti',
  'footer.calendar': 'Calendario .ics',
  'footer.rss': 'Feed RSS',
  'footer.json': 'Dati JSON',
  'footer.contribute': 'Contribuisci',
  'footer.addCommunity': 'Aggiungi una community',
  'footer.reportError': 'Segnala un errore',
  'footer.sourceCode': 'Codice sorgente',
  'footer.licenses': 'Licenze',
  'footer.licenseCode': 'Codice',
  'footer.licenseMapsPrefix': 'Mappe © collaboratori',
  'footer.licenseMapsSuffix': '',
  'footer.dataLicense': 'dati ODbL 1.0',
  'footer.madeIn': 'software libero, fatto a Catania',

  // --- Home ---
  'home.title': 'catania.community',
  'home.metaDescription':
    'Gli eventi delle community di Catania e provincia, raccolti in una pagina sola.',
  'home.metaDescriptionCount':
    '{count} eventi in arrivo dalle community di Catania e provincia: meetup, workshop e incontri. Aggiornato automaticamente.',
  'home.headline': 'Tutto quello che succede a Catania.',
  'home.headlineAccent': 'Una pagina sola.',
  'home.intro':
    "Eventi delle community della città e della provincia. Noi facciamo da specchio: il biglietto e l'iscrizione restano dove sono già.",
  'home.emptyNoEvents':
    'Nessun evento in programma in questo momento. I crawler controllano le fonti due volte al giorno; se organizzi qualcosa,',
  'home.emptyNoEventsLink': 'segnalacelo',
  'home.emptyFiltered': 'Nessun evento corrisponde ai filtri scelti.',
  'home.communitiesCta':
    'Chi organizza, ogni quanto, su cosa. Se ne manca una, bastano nome e link: la importiamo noi.',
  'home.communitiesLink': 'Vedi le community →',

  // --- Filters ---
  'filters.label': 'Filtra',
  'filters.aria': 'Filtra gli eventi',
  'filters.period': 'Periodo',
  'filters.next30': 'Prossimi 30 giorni',
  'filters.where': 'Dove',
  'filters.cost': 'Costo',
  'filters.freeOnly': 'Solo gratis',
  'filters.topic': 'Argomento',
  'filters.reset': 'Azzera',

  // --- Event list ---
  'event.goTo': "Vai all'evento",
  'event.seatsLeft': '{count} posti rimasti',
  'event.today': 'Oggi',
  'event.tomorrow': 'Domani',
  'event.oneEvent': '1 evento',
  'event.nEvents': '{count} eventi',

  // --- Map and calendar ---
  'map.caption': 'Mappa OpenStreetMap',
  'map.noScript':
    'La mappa richiede JavaScript. Gli eventi sono comunque tutti in elenco qui accanto.',
  'map.offscreenOne': '1 evento senza luogo sulla mappa',
  'map.offscreenMany': '{count} eventi senza luogo sulla mappa',
  'map.osmAttribution': '© collaboratori OpenStreetMap',
  'map.details': 'Vedi i dettagli',
  'map.openIn': 'Apri {name} su OpenStreetMap →',
  'calendar.aria': 'Calendario di {month}',
  'calendar.legend': 'un pallino = un evento in quel giorno',
  'calendar.dayAria': '{day}: {events}',
  'calendar.weekdays': 'L,M,M,G,V,S,D',

  // --- Event detail ---
  'eventPage.breadcrumb': '← Tutti gli eventi',
  'eventPage.pastNotice':
    'Questo evento è già passato. Lo teniamo online come archivio della community.',
  'eventPage.cancelledNotice': 'Questo evento è stato annullato.',
  'eventPage.communitySince': ' · community dal {year}',
  'eventPage.beginnerFriendly': 'Adatto ai principianti',
  'eventPage.where': 'Dove',
  'eventPage.when': 'Quando',
  'eventPage.admission': 'Ingresso',
  'eventPage.registrationHint':
    "L'iscrizione avviene sul sito della community. Qui non gestiamo biglietti.",
  'eventPage.addToCalendar': 'Aggiungi al calendario',
  'eventPage.organiser': 'Organizza',
  'eventPage.seeCommunity': 'Vedi la community →',
  'eventPage.dataSource':
    'Dati importati dalle pagine pubbliche della community. Qualcosa non torna?',
  'eventPage.reportIt': 'Segnalalo',
  'eventPage.metaFallback':
    '{title} — {date} a {city}. Organizza {community}.',

  // --- Communities ---
  'communities.title': '{count} community',
  'communities.titleOne': '1 community',
  'communities.metaDescription':
    'Chi organizza eventi a Catania e provincia: tech, design, cultura, impresa e sociale. Elenco aperto, mantenuto dalla community stessa.',
  'communities.intro':
    'Chi organizza, ogni quanto, su cosa. Se ne manca una, apri una segnalazione: entro pochi giorni la importiamo.',
  'communities.addYours': 'Aggiungi la tua →',
  'communities.members': '{count} iscritti',
  'communities.next': 'prossimo {date}',
  'communities.noUpcoming': 'nessun evento in programma',
  'communities.ctaTitle': 'La tua community qui',
  'communities.ctaBody':
    'Bastano nome, link e dove pubblicate gli eventi. Da lì in poi li importiamo noi, due volte al giorno.',
  'communities.ctaButton': 'Segnala una community',
  'communities.ctaGithub': 'Su GitHub',

  'community.breadcrumb': '← Tutte le community',
  'community.upcoming': 'Prossimi eventi',
  'community.past': 'Eventi passati',
  'community.noUpcoming':
    'Nessun evento in programma al momento. Controlliamo le fonti due volte al giorno: se ne pubblicano uno, compare qui da solo.',
  'community.venueTbc': 'Sede da confermare',
  'community.cadence': 'Ritmo',
  'community.language': 'Lingua',
  'community.usualVenue': 'Sede abituale',
  'community.membersLabel': 'Iscritti',
  'community.since': 'Attiva dal',
  'community.reportOnGithub': 'Segnalalo su GitHub',
  'community.metaFallback':
    '{name}: eventi, ritmo e contatti. {count} eventi in programma a Catania.',
  'community.linkWebsite': 'Sito della community',

  // --- Submit form ---
  'submit.title': 'Aggiungi la tua community',
  'submit.metaDescription':
    "Aggiungi la tua community all'agenda di Catania. Non serve un account GitHub: bastano nome, link e dove pubblicate gli eventi.",
  'submit.intro':
    'Bastano nome, link e dove pubblicate gli eventi. Da lì in poi li importiamo noi, due volte al giorno, senza che dobbiate ricordarvi di aggiornare niente.',
  'submit.sectionCommunity': 'La community',
  'submit.fieldName': 'Nome',
  'submit.fieldTagline': 'In una riga',
  'submit.fieldTaglinePlaceholder': 'Cosa fate, in poche parole',
  'submit.fieldTopics': 'Argomenti',
  'submit.fieldArea': 'Dove vi trovate di solito',
  'submit.required': 'obbligatorio',
  'submit.sectionEvents': 'Dove pubblicate gli eventi',
  'submit.eventsHelp':
    'È la parte che conta di più. Se avete un feed .ics o una pagina su gdg.community.dev, Luma, Gancio o Mobilizon, li leggiamo in automatico. Meetup ed Eventbrite purtroppo hanno chiuso le API: da lì dobbiamo copiare a mano.',
  'submit.fieldEventsUrl': 'Link principale',
  'submit.fieldIcsUrl': "Feed .ics, se ce l'avete",
  'submit.fieldContacts': 'Altri contatti',
  'submit.fieldContactsPlaceholder': 'Telegram, Instagram, sito…',
  'submit.sectionContact': 'Per ricontattarti',
  'submit.fieldContact': 'Email o handle',
  'submit.fieldContactPlaceholder': 'Solo se vuoi una risposta',
  'submit.contactHelp':
    'Finisce in una issue pubblica su GitHub, insieme al resto. Non scriverla se preferisci restare anonimo.',
  'submit.button': 'Invia la segnalazione',
  'submit.buttonIssue': 'Preferisco aprire una issue',
  'submit.noScript':
    'Questo modulo ha bisogno di JavaScript per funzionare. Puoi comunque aprire una issue su GitHub, che è esattamente ciò che il modulo fa per te.',
  'submit.missing': 'Manca {fields}.',
  'submit.missingName': 'il nome',
  'submit.missingUrl': 'il link principale',
  'submit.missingTopics': 'almeno un argomento',
  'submit.sending': 'Invio in corso…',
  'submit.okWithLink':
    'Fatto. La segnalazione è diventata una issue pubblica: la trovi al link qui sotto.',
  'submit.ok': 'Fatto, grazie. La segnalazione è stata registrata.',
  'submit.openIssue': ' Apri la issue →',
  'submit.failed': 'Non sono riuscito a inviare. ',
  'submit.failedLink': 'Apri la issue su GitHub con i dati già compilati →',
  'submit.nextTitle': 'Cosa succede dopo',
  'submit.next1': 'La segnalazione diventa una issue pubblica sul repository.',
  'submit.next2': "Un'automazione la trasforma in una pull request con il file già pronto.",
  'submit.next3':
    'Al merge la community è online, e i suoi eventi iniziano ad arrivare da soli.',
  'submit.nextHint':
    'Tutto avviene alla luce del sole: nessuna moderazione privata, la cronologia è nel repository.',
  'submit.fixTitle': 'Segnalare un errore',
  'submit.fixBody':
    'Data sbagliata, luogo cambiato, evento annullato: apri una correzione e la sistemiamo a mano, con la precedenza sui dati automatici.',
  'submit.fixButton': 'Segnala una correzione →',

  // --- 404 ---
  'notFound.eyebrow': 'Errore 404',
  'notFound.title': "Questa pagina non c'è.",
  'notFound.body':
    'Può essere un evento rimosso alla fonte o un indirizzo scritto male. Gli eventi passati restano online, quindi se cercavi qualcosa di vecchio dovrebbe essere ancora lì.',
  'notFound.toEvents': 'Vai agli eventi',
  'notFound.toCommunities': 'Vedi le community',

  // --- Domain vocabulary ---
  'category.tech': 'Tech',
  'category.design': 'Design',
  'category.impresa': 'Impresa',
  'category.cultura': 'Cultura',
  'category.sociale': 'Sociale',

  'area.citta': 'Catania città',
  'area.provincia': 'Provincia',
  'area.online': 'Online',

  'price.free': 'Gratis',
  'price.donation': 'Offerta libera',
  'price.paid': 'A pagamento',

  'status.cancelled': 'Annullato',
  'status.online': 'Online',

  // --- Feeds ---
  'feed.calendarName': 'Eventi delle community di Catania',
  'feed.rssTitle': 'Eventi delle community di Catania',
  'feed.rssDescription':
    'Meetup, workshop e incontri delle community di Catania e provincia.',
  'feed.organiser': 'Organizza: {name}',
  'feed.detailsAt': 'Dettagli e iscrizione: {url}',
  'feed.where': 'Dove: {place}',
  'feed.at': '{date} alle {time}',
} as const;

export type TranslationKey = keyof typeof it;
