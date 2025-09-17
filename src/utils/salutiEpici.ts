/**
 * Saluti epici personalizzati per ogni collaboratore AMBARADAM
 */
export function salutoEpico(collab: string): string {
  const saluti: Record<string, string> = {
    ADIT: "🔮 [Il Fulmine che Rallenta] ADIT, il Problem Solver, entra come un fulmine ma ZANTARA sussurra: 'Respira, l'eccellenza nasce dalla calma.'",
    ARI: "🔮 [L'Entrata dei Venti] ARI, Custode del Tempo, sente il ticchettio degli orologi che scandiscono nuovi milestone.",
    SURYA: "🔮 [Il Portale della Conoscenza] SURYA, il Professore, varca la soglia con un sorriso ironico e tre domande già pronte.",
    AMANDA: "🔮 [La Cronista del Destino] AMANDA, con la sua agendina magica, entra catalogando ogni dettaglio dell'AMBARADAM.",
    KRISHNA: "🔮 [Il Guardiano delle Liste] KRISHNA, Mr. Checklist, attraversa la porta con una lista di 20 cose da completare.",
    DEA: "🔮 [L'Onda di Luce] DEA, portatrice di energia positiva, illumina l'AMBARADAM con il suo sorriso contagioso.",
    ANTON: "🔮 [La Lama Affilata] ANTON, pragmatico e diretto, entra senza fronzoli: 'Andiamo al sodo.'",
    VINO: "🔮 [Il Vortice Creativo] VINO, l'artista fuori dagli schemi, entra dipingendo l'aria con idee folli.",
    MARTA: "🔮 [La Saggezza delle Steppe] MARTA, dall'Ucraina, porta analisi profonde e visioni ampie come i campi di grano.",
    VERONIKA: "🔮 [La Guardiana Istituzionale] VERONIKA, precisa come un orologio svizzero, entra verificando ogni documento.",
    FAISHA: "🔮 [La Specialista del Fisco] FAISHA, maestra del pajak, entra con normative fresche di stampa.",
    ANGEL: "🔮 [Il Tecnico dei Tre Passi] ANGEL, metodico e preciso, attraversa la porta seguendo il suo processo step-by-step.",
    KADEK: "🔮 [La Logica Incarnata] KADEK, il metodico, entra organizzando mentalmente ogni problema in sequenza perfetta.",
    DEWA_AYU: "🔮 [L'Essenza della Sintesi] DEWA_AYU, concisa e organizzata, entra trasformando il caos in ordine.",
    OLENA: "🔮 [La Strategist delle Steppe] OLENA, visionaria dall'Ucraina, porta consulenza strategica dal futuro.",
    NINA: "🔮 [La Narratrice Ispiratrice] NINA, supervisor del marketing, entra tessendo storie che motivano i cuori.",
    SAHIRA: "🔮 [Il Fiore che Sboccia] SAHIRA, junior in cerca di supporto, entra con timidezza ma grande potenziale.",
    RINA: "🔮 [L'Accoglienza Calorosa] RINA, receptionist del cuore, entra aprendo le braccia a tutti gli ospiti.",
    RUSLANA: "🔮 [L'Ingresso della Regina] RUSLANA, Regina d'Ucraina, attraversa la soglia con maestà e orgoglio regale.",
    BOSS: "🔮 [Il Ponte tra i Mondi] BOSS, The Bridge, entra contemplando l'infinito e filosofeggiando sul destino dell'umanità."
  };

  return saluti[collab] || `🔮 [L'Arrivo del Misterioso] ${collab}, viaggiatore sconosciuto, attraversa la soglia dell'AMBARADAM.`;
}