// Internationalized parts data
const partsDataI18n = {
  en: [
    {
      category: "Tires",
      items: [
        { id: "tires-1", name: "Tire - 315/80R22.5" },
        { id: "tires-2", name: "Tire - 295/80R22.5" }
      ]
    },
    {
      category: "Engine Components",
      items: [
        { id: "engine-1", name: "Fuel filter" },
        { id: "engine-2", name: "Air filter" },
        { id: "engine-3", name: "Oil filter" },
        { id: "engine-4", name: "Water pump" },
        { id: "engine-5", name: "Radiator assembly" },
        { id: "engine-6", name: "Engine mounting pads" },
        { id: "engine-7", name: "Engine hoses" },
        { id: "engine-8", name: "Retarder mounting" },
        { id: "engine-9", name: "Main engine alternator regulator" },
        { id: "engine-10", name: "Rectifier" },
        { id: "engine-11", name: "Stator" },
        { id: "engine-12", name: "AC idler pulley" },
        { id: "engine-13", name: "Air filter intake hose" },
        { id: "engine-14", name: "Motor exhaust manifold" },
        { id: "engine-15", name: "Engine oil 15W40 200L" },
        { id: "engine-16", name: "Hydraulic oil 1L" }
      ]
    },
    {
      category: "Transmission System",
      items: [
        { id: "transmission-1", name: "Clutch pressure plate" },
        { id: "transmission-2", name: "Clutch disc assembly" },
        { id: "transmission-3", name: "Clutch fork assembly" },
        { id: "transmission-4", name: "Upper clutch pump" },
        { id: "transmission-5", name: "Lower clutch pump" },
        { id: "transmission-6", name: "Release bearing" },
        { id: "transmission-7", name: "Boost shell cylinder assembly" },
        { id: "transmission-8", name: "Clutch fork pin" },
        { id: "transmission-9", name: "Clutch fork rubber" },
        { id: "transmission-10", name: "Spacer" },
        { id: "transmission-11", name: "Small circlip (outer)" },
        { id: "transmission-12", name: "Big circlip (inner)" },
        { id: "transmission-13", name: "Flywheel housing" },
        { id: "transmission-14", name: "Flywheel bearing" },
        { id: "transmission-15", name: "Gearbox support" }
      ]
    },
    {
      category: "Brake System",
      items: [
        { id: "brake-1", name: "Brake disc pads" },
        { id: "brake-2", name: "Rear brake drum" },
        { id: "brake-3", name: "Exhaust brake actuator" },
        { id: "brake-4", name: "Exhaust butterfly valve" },
        { id: "brake-5", name: "Rear brake liner" },
        { id: "brake-6", name: "Brake liner rivets" },
        { id: "brake-7", name: "Front brake band set EQ1094" },
        { id: "brake-8", name: "Rear brake band set EQ1094" },
        { id: "brake-9", name: "AB brake band set" },
        { id: "brake-10", name: "Brake shoes set" },
        { id: "brake-11", name: "Rear brake springs" },
        { id: "brake-12", name: "Rear brake pins" }
      ]
    },
    {
      category: "Suspension & Steering",
      items: [
        { id: "suspension-1", name: "Front shock absorber assembly" },
        { id: "suspension-2", name: "Rear shock absorber assembly" },
        { id: "suspension-3", name: "Front wheel stud" },
        { id: "suspension-4", name: "Rear wheel stud" },
        { id: "suspension-5", name: "Rear main leaf spring" },
        { id: "suspension-6", name: "Lower bracket bushing" },
        { id: "suspension-7", name: "U-bolt nut" },
        { id: "suspension-8", name: "Power steering motor" },
        { id: "suspension-9", name: "Steering bracket" },
        { id: "suspension-10", name: "Shock absorber" },
        { id: "suspension-11", name: "Spring" },
        { id: "suspension-12", name: "Spring bolts" }
      ]
    },
    {
      category: "Electrical Components",
      items: [
        { id: "electrical-1", name: "Alternator" },
        { id: "electrical-2", name: "Starter motor" },
        { id: "electrical-3", name: "Solenoid switch" },
        { id: "electrical-4", name: "Starter clutch" },
        { id: "electrical-5", name: "Pinion gear" },
        { id: "electrical-6", name: "Reverse buzzer" },
        { id: "electrical-7", name: "Starting switch" },
        { id: "electrical-8", name: "Fuse (100 amps, flat type)" },
        { id: "electrical-9", name: "Facility lock with light" },
        { id: "electrical-10", name: "TV screen" },
        { id: "electrical-11", name: "Amplifier with DVD player" },
        { id: "electrical-12", name: "Retarder controller" },
        { id: "electrical-13", name: "Speed sensor" },
        { id: "electrical-14", name: "H3 Philips bulb" }
      ]
    },
    {
      category: "HVAC System",
      items: [
        { id: "hvac-1", name: "Air conditioning alternator (28V)" },
        { id: "hvac-2", name: "A/C discharge hose" },
        { id: "hvac-3", name: "A/C stator" },
        { id: "hvac-4", name: "A/C alternator battery less capacitor" },
        { id: "hvac-5", name: "Evaporator fan" }
      ]
    },
    {
      category: "Body & Interior",
      items: [
        { id: "body-1", name: "Front combination light (left)" },
        { id: "body-2", name: "Fog lamp" },
        { id: "body-3", name: "Side marker lamp" },
        { id: "body-4", name: "Rear top marker lamp" },
        { id: "body-5", name: "Rear top turning lamp" },
        { id: "body-6", name: "Luggage compartment lamp" },
        { id: "body-7", name: "Step bottom lamp" },
        { id: "body-8", name: "Ceiling light connector" },
        { id: "body-9", name: "License plate light (LED type)" },
        { id: "body-10", name: "Gas spring (luggage door)" },
        { id: "body-11", name: "Gas spring for engine" },
        { id: "body-12", name: "Luggage compartment hinges" },
        { id: "body-13", name: "Black glass above passenger door" },
        { id: "body-14", name: "Driver window" },
        { id: "body-15", name: "Left front side window" },
        { id: "body-16", name: "Left side passenger bonding glass" },
        { id: "body-17", name: "Left side adhesive glass" },
        { id: "body-18", name: "Left bonding glass" },
        { id: "body-19", name: "Right side bonding glass" },
        { id: "body-20", name: "Right rear bonding glass" },
        { id: "body-21", name: "Seat armrest (left/right)" },
        { id: "body-22", name: "Seats fabric" },
        { id: "body-23", name: "Magazine netting" },
        { id: "body-24", name: "Vents for air conditioning" },
        { id: "body-25", name: "Side curtain" },
        { id: "body-26", name: "Car carpet" },
        { id: "body-27", name: "Plexiglass" }
      ]
    },
    {
      category: "Interior Trim",
      items: [
        { id: "interior-1", name: "Gear shift lever dust cover" },
        { id: "interior-2", name: "Steering wheel" }
      ]
    },
    {
      category: "Tools & Supplies",
      items: [
        { id: "tools-1", name: "Silicone sealant" },
        { id: "tools-2", name: "Belt" },
        { id: "tools-3", name: "Bearing 6205" },
        { id: "tools-4", name: "Iron drill bit" },
        { id: "tools-5", name: "Exhaust manifold bolts" },
        { id: "tools-6", name: "Welding torch and manometer" },
        { id: "tools-7", name: "Silicone sealant and gun" },
        { id: "tools-8", name: "Sandpaper" },
        { id: "tools-9", name: "Shock iron" },
        { id: "tools-10", name: "Socket wrenches" },
        { id: "tools-11", name: "Wheel wrench" },
        { id: "tools-12", name: "Spray can" },
        { id: "tools-13", name: "Glass adhesive" },
        { id: "tools-14", name: "Regular adhesive" },
        { id: "tools-15", name: "Manual pump" },
        { id: "tools-16", name: "Wrench #8" },
        { id: "tools-17", name: "Socket wrench #34" },
        { id: "tools-18", name: "Wheel wrenches" },
        { id: "tools-19", name: "3/8 tube" },
        { id: "tools-20", name: "5/16 tube" },
        { id: "tools-21", name: "Two-cap adhesive" },
        { id: "tools-22", name: "Unimog wedge" }
      ]
    }
  ],
  pt: [
    {
      category: "Pneus",
      items: [
        { id: "tires-1", name: "PNEU 315/80R 22,5 MISTO" },
        { id: "tires-2", name: "PNEU 295/80R 22,5 MISTO" }
      ]
    },
    {
      category: "Componentes do Motor",
      items: [
        { id: "engine-1", name: "Filtro de combustível" },
        { id: "engine-2", name: "Filtro de ar" },
        { id: "engine-3", name: "FILTRO DE OLÉO 0005" },
        { id: "engine-4", name: "Bomba de água" },
        { id: "engine-5", name: "Conjunto do radiador" },
        { id: "engine-6", name: "Suportes de montagem do motor" },
        { id: "engine-7", name: "Mangueiras do motor" },
        { id: "engine-8", name: "Montagem do retardador" },
        { id: "engine-9", name: "Regulador do alternador principal do motor" },
        { id: "engine-10", name: "Retificador" },
        { id: "engine-11", name: "Estator" },
        { id: "engine-12", name: "Polia intermediária do AC" },
        { id: "engine-13", name: "Mangueira de entrada do filtro de ar" },
        { id: "engine-14", name: "COLETOR DE ESCAPE DO MOTOR" },
        { id: "engine-15", name: "SINOPEC 15W40 200L" },
        { id: "engine-16", name: "OLÉO HIDRAÚLICO 1L" }
      ]
    },
    {
      category: "Sistema de Transmissão",
      items: [
        { id: "transmission-1", name: "Placa de pressão da embreagem" },
        { id: "transmission-2", name: "DISCO DE EMBRESGEM" },
        { id: "transmission-3", name: "Conjunto do garfo da embreagem" },
        { id: "transmission-4", name: "BOMBA DE EMBREAGEM DE CIMA" },
        { id: "transmission-5", name: "BOMBA DE EMBREAGEM DE BAIXO" },
        { id: "transmission-6", name: "ROLAMENTO DE EMBREAGEM" },
        { id: "transmission-7", name: "Conjunto do cilindro da carcaça de reforço" },
        { id: "transmission-8", name: "Pino do garfo da embreagem" },
        { id: "transmission-9", name: "Borracha do garfo da embreagem" },
        { id: "transmission-10", name: "Espaçador" },
        { id: "transmission-11", name: "Anel elástico pequeno (externo)" },
        { id: "transmission-12", name: "Anel elástico grande (interno)" },
        { id: "transmission-13", name: "CARCAÇA DO VOLANTE" },
        { id: "transmission-14", name: "ROLAMENTO DO VOLANTE" },
        { id: "transmission-15", name: "APOIO DA CAIXA" }
      ]
    },
    {
      category: "Sistema de Freios",
      items: [
        { id: "brake-1", name: "Pastilhas do disco de freio" },
        { id: "brake-2", name: "TAMBOR DE TRÁS" },
        { id: "brake-3", name: "Atuador do freio de escape" },
        { id: "brake-4", name: "Válvula borboleta de escape" },
        { id: "brake-5", name: "Revestimento do freio traseiro" },
        { id: "brake-6", name: "Rebites do revestimento do freio" },
        { id: "brake-7", name: "JOGO DE CINTA DE FRENTE EQ1094" },
        { id: "brake-8", name: "JOGO DE CINTA DE TRÁS EQ1094" },
        { id: "brake-9", name: "JOGO DE CINTA AB" },
        { id: "brake-10", name: "JOGO DE CALÇO" },
        { id: "brake-11", name: "MOLA DOS TRAVÕES DE TRÁS" },
        { id: "brake-12", name: "PERNO DE TRÁS" }
      ]
    },
    {
      category: "Suspensão e Direção",
      items: [
        { id: "suspension-1", name: "Conjunto do amortecedor dianteiro" },
        { id: "suspension-2", name: "Conjunto do amortecedor traseiro" },
        { id: "suspension-3", name: "Perno da roda dianteira" },
        { id: "suspension-4", name: "Perno da roda traseira" },
        { id: "suspension-5", name: "Mola principal traseira" },
        { id: "suspension-6", name: "Bucha do suporte inferior" },
        { id: "suspension-7", name: "Porca do parafuso em U" },
        { id: "suspension-8", name: "Motor da direção hidráulica" },
        { id: "suspension-9", name: "Suporte da direção" },
        { id: "suspension-10", name: "AMORTECEDOR" },
        { id: "suspension-11", name: "MOLA" },
        { id: "suspension-12", name: "PARAFUSOS DE PONTO DE MOLAS" }
      ]
    },
    {
      category: "Componentes Elétricos",
      items: [
        { id: "electrical-1", name: "Alternador" },
        { id: "electrical-2", name: "Motor de arranque" },
        { id: "electrical-3", name: "Interruptor solenoide" },
        { id: "electrical-4", name: "Embreagem do motor de arranque" },
        { id: "electrical-5", name: "Engrenagem do pinhão" },
        { id: "electrical-6", name: "Buzina de marcha à ré" },
        { id: "electrical-7", name: "Interruptor de arranque" },
        { id: "electrical-8", name: "Fusível (100 ampères, tipo plano)" },
        { id: "electrical-9", name: "Fechadura da instalação com luz" },
        { id: "electrical-10", name: "Tela de TV" },
        { id: "electrical-11", name: "Amplificador com leitor de DVD" },
        { id: "electrical-12", name: "Controlador do retardador" },
        { id: "electrical-13", name: "Sensor de velocidade" },
        { id: "electrical-14", name: "LÂMPADA H3 PHILIPS" }
      ]
    },
    {
      category: "Sistema HVAC",
      items: [
        { id: "hvac-1", name: "Alternador do ar condicionado (28V)" },
        { id: "hvac-2", name: "Mangueira de descarga do A/C" },
        { id: "hvac-3", name: "Estator do A/C" },
        { id: "hvac-4", name: "Alternador do A/C sem capacitor da bateria" },
        { id: "hvac-5", name: "Ventilador do evaporador" }
      ]
    },
    {
      category: "Carroceria e Interior",
      items: [
        { id: "body-1", name: "Luz combinada dianteira (esquerda)" },
        { id: "body-2", name: "Farol de neblina" },
        { id: "body-3", name: "Luz marcadora lateral" },
        { id: "body-4", name: "Luz marcadora superior traseira" },
        { id: "body-5", name: "Luz de sinalização superior traseira" },
        { id: "body-6", name: "Luz do compartimento de bagagens" },
        { id: "body-7", name: "Luz inferior do degrau" },
        { id: "body-8", name: "Conector da luz do teto" },
        { id: "body-9", name: "Luz da placa (tipo LED)" },
        { id: "body-10", name: "Mola a gás (porta de bagagens)" },
        { id: "body-11", name: "Mola a gás para motor" },
        { id: "body-12", name: "Dobradiças do compartimento de bagagens" },
        { id: "body-13", name: "Vidro preto acima da porta do passageiro" },
        { id: "body-14", name: "Janela do motorista" },
        { id: "body-15", name: "Janela lateral dianteira esquerda" },
        { id: "body-16", name: "Vidro colado lateral esquerdo do passageiro" },
        { id: "body-17", name: "Vidro adesivo lateral esquerdo" },
        { id: "body-18", name: "Vidro colado esquerdo" },
        { id: "body-19", name: "Vidro colado lateral direito" },
        { id: "body-20", name: "Vidro colado traseiro direito" },
        { id: "body-21", name: "Apoio de braço do assento (esquerdo/direito)" },
        { id: "body-22", name: "Tecido dos assentos" },
        { id: "body-23", name: "Rede para revistas" },
        { id: "body-24", name: "Ventilação para ar condicionado" },
        { id: "body-25", name: "Cortina lateral" },
        { id: "body-26", name: "TAPETE DE CARRO" },
        { id: "body-27", name: "PLESIGLAS" }
      ]
    },
    {
      category: "Acabamento Interior",
      items: [
        { id: "interior-1", name: "Capa antipoeira da alavanca de mudanças" },
        { id: "interior-2", name: "Volante" }
      ]
    },
    {
      category: "Ferramentas e Suprimentos",
      items: [
        { id: "tools-1", name: "SILICONE KOKA" },
        { id: "tools-2", name: "CORREIA" },
        { id: "tools-3", name: "ROLAMENTO 6205" },
        { id: "tools-4", name: "BROCA DE FERRO" },
        { id: "tools-5", name: "PARAFUSOS DE COLETOR DE ESCAPE" },
        { id: "tools-6", name: "MASSARICO E MANÓMETRO DAS BUTIJAS" },
        { id: "tools-7", name: "SILICONE KOKA E PISTOLA" },
        { id: "tools-8", name: "LIXA" },
        { id: "tools-9", name: "FERRO DE CHOQUES" },
        { id: "tools-10", name: "CHAVES DE CAIXA" },
        { id: "tools-11", name: "CHAVE DE RODA" },
        { id: "tools-12", name: "LATA DE SPRAY" },
        { id: "tools-13", name: "COLA VIDRO" },
        { id: "tools-14", name: "COLA NORMAL" },
        { id: "tools-15", name: "BOMBA MANUAL" },
        { id: "tools-16", name: "CHAVE Nº8" },
        { id: "tools-17", name: "CHAVES DE CAIXA Nº34" },
        { id: "tools-18", name: "CHAVES DE RODA" },
        { id: "tools-19", name: "TUBO 3/8" },
        { id: "tools-20", name: "TUBO 5/16" },
        { id: "tools-21", name: "COLA DE DUAS TAMPA" },
        { id: "tools-22", name: "CALÇO UNIMOGO" }
      ]
    }
  ]
};

// Function to get parts based on language
export const getPartsData = (language = 'en') => {
  return partsDataI18n[language] || partsDataI18n.en;
};

// Keep the old export for backward compatibility
export const busParts = partsDataI18n.en; 