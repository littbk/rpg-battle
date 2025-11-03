const fs = require('fs-extra');
const path = require('path');
const charactersPath = path.resolve(__dirname, '../../data/character/');
const profilesPath = path.resolve(__dirname, '../../data/profiles');
const charGameDataPath = path.resolve(__dirname, '../../data/charGameData.json');
const jsonfile = require('jsonfile');
const Personagem = require('../classes/character.js');

// LER JSON PERSONAGEM
async function readCharacterFile(filename) {
    try {
       

        // NOTA: A lógica original de criar um diretório com o mesmo nome do arquivo é mantida.
        const dir = path.resolve(charactersPath, filename);
        // NOTA: A barra '/' inicial foi removida para corrigir um bug de caminho.
        const filePath = path.join(dir, `${filename}.json`);

        if (!fs.existsSync(filePath)) {
            return false;
        }

        const fileData = await fs.readJSON(filePath);
        const c = new Personagem(fileData);
        // characterCache[filename] = c; // Cache desativado para manter a simplicidade original.

        return c;
    } catch (error) {
        console.error(`Erro em readCharacterFile para '${filename}':`, error);
        return null;
    }
}

// SALVAR DADOS PERSONAGEM
async function writeCharacterFile(filename, charData) {
    try {
        const normalizedName = normalizeName(charData.nome);
        if (!normalizedName) throw new Error("Nome do personagem é inválido.");

        const dir = path.resolve(charactersPath, normalizedName);
        await fs.promises.mkdir(dir, { recursive: true });

        if (!isValidObject(charData)) {
            throw new Error('O objeto charData é inválido.');
        }

        const jsonData = JSON.stringify(charData, null, 2);
        await fs.promises.writeFile(path.join(dir, `${normalizedName}.json`), jsonData);
        return charData;
    } catch (error) {
        console.trace();
        console.table(charData);
        console.error(`Erro ao salvar o arquivo para o personagem '${charData.nome}': ${error}`);
        return false;
    }
}

// Função auxiliar para verificar se um objeto é válido (mantida como original)
function isValidObject(obj) {
    if (typeof obj === 'object' && obj !== null) {
        const keys = Object.keys(obj);
        const uniqueKeys = new Set(keys);
        if (keys.length !== uniqueKeys.size) return false;
        for (const key in obj) {
            const value = obj[key];
            if (typeof value === 'object') {
                if (!isValidObject(value)) return false;
            }
        }
        return true;
    }
    return false;
}

// VERIFICAR SE A FICHA EXISTE
async function fileExists(filename) {
    try {
        const normalizedFilename = normalizeName(filename);
        const filePath = path.join(charactersPath, normalizedFilename, `${normalizedFilename}.json`);
        // Usando fs.pathExists de fs-extra para uma checagem assíncrona mais limpa
        const exists = await fs.pathExists(filePath);
        return exists ? 'char' : false;
    } catch (error) {
        console.log(error);
        return false;
    }
}

// CRIAR PERSONAGEM
async function createCharacter(filename, novoPersonagem, isModal) {
    try {
        const normalizedFilename = normalizeName(filename);
        const filePath = path.join(charactersPath, normalizedFilename, `${normalizedFilename}.json`);

        const templatePath = path.resolve(__dirname, '../../config/defaultClassModels/character.json');
        const data = await jsonfile.readFile(templatePath);

        data.nome = novoPersonagem.nome; // Mantém o nome original com case
        data.playerName = novoPersonagem.player;
        data.id = novoPersonagem.id;

        if (isModal) {
            data.idade = novoPersonagem.idade;
            data.sexo = novoPersonagem.sexo;
            data.nascimento = novoPersonagem.dataNascimento;
        }

        if (fs.existsSync(filePath)) {
            console.error(`O arquivo ${filename} já existe.`);
            return false;
        }

        await writeCharacterFile(filename, data); // writeCharacterFile já normaliza internamente
        return data;
    } catch (error) {
        console.log(error);
        return false; // Adicionado retorno em caso de erro
    }
}

// LER PERSONAGEM
async function readCharacter(filename) {
    return fileExists(filename); // Mantém comportamento original
}

async function readCharacterActive(userId) {
    try {
        // Lê o arquivo JSON com todos os personagens.
        const jsonData = await jsonfile.readFile(charGameDataPath);

        // Procura nos valores do JSON pelo personagem que tenha o ID do jogador
        // correspondente E que esteja com o status "active: true".
        const activeCharacter = Object.values(jsonData).find(character =>
            character.playerId === userId && character.active === true
        );

        // Retorna o objeto do personagem encontrado, ou null se não encontrar.
            return activeCharacter || null;

    } catch (error) {
        console.error(`Erro ao ler o arquivo de personagens: ${error}`);
        // Retorna null também em caso de erro para um comportamento consistente.
        return null;
    }
}

async function getCharacterDatabase(filename) {
    try {
        const normalizedFilename = normalizeName(filename);
        const jsonData = await jsonfile.readFile(charGameDataPath);
        const activeCharacter = Object.values(jsonData).find(character => normalizeName(character.nome) === normalizedFilename);
        return activeCharacter || false;
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${charGameDataPath}: ${error}`);
        return false;
    }
}

async function updateCharacter(message, filename, params) {
    try {
        console.trace()
        if (message?.channel.name.includes('debug')) return await getCharacterClassDirect(message);
        const normalizedFilename = normalizeName(filename);
        const existingData = await readCharacterFile(normalizedFilename);
        if (!existingData) {
            throw new Error(`O arquivo ${filename} não existe.`);
        }

        Object.assign(existingData, params);
        if (existingData.hpa > existingData.hp) existingData.hpa = existingData.hp;

        await writeCharacterFile(normalizedFilename, existingData);

        if (existingData.temGemini) {
            const normalizedGeminiName = normalizeName(existingData.temGemini);
            const allowedParams = new Set(['dinheiro', 'hpa', 'dadosVida', 'step', 'status1', 'status2', 'status3', 'statusCt1', 'statusCt2', 'statusCt3', 'posicao', 'alvo', 'dl', 'dc', 'battlerId', 'tp', 'tpTemp']);
            const filteredParams = Object.fromEntries(Object.entries(params).filter(([key]) => allowedParams.has(key)));

            const existingDataG = await readCharacterFile(normalizedGeminiName);
            if (existingDataG) { // Garante que o Gêmeo existe antes de tentar atualizar
                Object.assign(existingDataG, filteredParams);
                if (existingDataG.hpa > existingDataG.hp) existingDataG.hpa = existingDataG.hp;
                if (existingDataG.ena > existingDataG.ap) existingDataG.ena = existingDataG.ap;
                if (existingDataG.staCt1 === 0) existingDataG.staCt1 = false;
                if (existingDataG.staCt2 === 0) existingDataG.staCt2 = false;
                if (existingDataG.staCt3 === 0) existingDataG.staCt3 = false;
                if (isNaN(existingDataG.tp)) existingDataG.tp = 0;
                await writeCharacterFile(normalizedGeminiName, existingDataG);
            }
        }
        return existingData;
    } catch (error) {
        console.error(`Erro ao atualizar personagem '${filename}': ${error}`);
        return false;
    }
}


async function updateCharacterSomando(message, filename, params) {
    try {
        if (message.channel.name.includes('debug')) return await getCharacterClassDirect(message);

        const normalizedFilename = normalizeName(filename);
        const existingData = await readCharacterFile(normalizedFilename);
        if (!existingData) {
            throw new Error(`O arquivo ${filename} não existe.`);
        }

        // Aceita só esses parâmetros
        const allowedParams = new Set(['hpa', 'ena', 'tp', 'tpTemp']);
        const filteredParams = Object.fromEntries(
            Object.entries(params).filter(([key]) => allowedParams.has(key))
        );

        // Faz a soma (se o valor já existir, soma; senão, inicia)
        for (const [key, value] of Object.entries(filteredParams)) {
            if (typeof value === 'number') {
                existingData[key] = (existingData[key] ?? 0) + value;
            }
        }

        // Restrições e ajustes
        if (existingData.hpa > existingData.hp) existingData.hpa = existingData.hp;
        if (existingData.ena > existingData.ap) existingData.ena = existingData.ap;
        if (isNaN(existingData.tp)) existingData.tp = 0;
        if (isNaN(existingData.tpTemp)) existingData.tpTemp = 0;

        await writeCharacterFile(normalizedFilename, existingData);

        // Se tiver gêmeo, propaga
        if (existingData.temGemini) {
            const normalizedGeminiName = normalizeName(existingData.temGemini);
            const existingDataG = await readCharacterFile(normalizedGeminiName);
            if (existingDataG) {
                for (const [key, value] of Object.entries(filteredParams)) {
                    if (typeof value === 'number') {
                        existingDataG[key] = (existingDataG[key] ?? 0) + value;
                    }
                }
                if (existingDataG.hpa > existingDataG.hp) existingDataG.hpa = existingDataG.hp;
                if (existingDataG.ena > existingDataG.ap) existingDataG.ena = existingDataG.ap;
                if (isNaN(existingDataG.tp)) existingDataG.tp = 0;
                if (isNaN(existingDataG.tpTemp)) existingDataG.tpTemp = 0;
                await writeCharacterFile(normalizedGeminiName, existingDataG);
            }
        }

        return existingData;
    } catch (error) {
        console.error(`Erro ao atualizar personagem (somando) '${filename}': ${error}`);
        return false;
    }
}


async function deleteCharacter(filename) {
    try {
        const normalizedFilename = normalizeName(filename);
        const charGameData = await jsonfile.readFile(charGameDataPath);

        const characterId = Object.keys(charGameData).find(key =>
            normalizeName(charGameData[key].nome) === normalizedFilename ||
            charGameData[key].id.toString() === normalizedFilename
        );

        if (!characterId) {
            console.error(`Personagem ${filename} não existe.`);
            return `Personagem ${filename} não existe.`;
        }

        const normalizedCharName = normalizeName(charGameData[characterId].nome);
        const folderPath = path.join(charactersPath, normalizedCharName);

        await fs.remove(folderPath); // Deleta a pasta antiga
        await fs.remove(path.join(charactersPath, `${normalizedCharName}.json`)); // Garante que o arquivo solto também seja deletado

        delete charGameData[characterId];
        await fs.writeFile(charGameDataPath, JSON.stringify(charGameData, null, 2));

        return `Personagem ${filename} deletado com sucesso.`;
    } catch (error) {
        console.error(`Erro ao deletar o personagem ${filename}: ${error}`);
        return `Erro ao deletar o personagem ${filename}. Verifique os logs.`;
    }
}

async function AllActiveStatus() {
    try {
        const fila = await jsonfile.readFile(charGameDataPath);
        let final = '';
        for (const key in fila) {
            const bp = fila[key];
            if (bp.active === true) {
                const p = await getCharacterClass(bp.nome);
                if (p) { // Adicionado verificação para prevenir crash
                    const atb = p.con + p.strOri + p.dexOri + p.intOri + p.sab + p.car + p.agiOri + p.will;
                    final += `[${p.id}] ${p.nome.split(' ')[0]} ${p.getHpAp()} • 🍽️ ${p.saciedade} • LV: ${p.nivel} [${atb}] \n`;
                } else {
                    final += `[${bp.id}] ${bp.nome.split(' ')[0]} - (ERRO: Ficha não encontrada)\n`;
                }
            }
        }
        return final === '' ? 'Fila Vazia!' : final;
    } catch (error) {
        console.log(error);
        console.log('ERRO EM FILA DE PRINT FILA');
        return 'ERRO EM FILA DE PRINT FILA';
    }
}

async function getActives() {
    try {
        const fila = await jsonfile.readFile(charGameDataPath);
        const final = [];
        for (const key in fila) {
            const bp = fila[key];
            if (bp.active === true) {
                const p = await getCharacterClass(bp.nome);
                if (p) final.push(p); // Adiciona apenas se o personagem for carregado com sucesso
            }
        }
        return final.length === 0 ? 'Sem personagens ativos!' : final;
    } catch (error) {
        console.log(error);
        console.log('ERRO EM FILA DE PRINT FILA');
        return 'ERRO EM FILA DE PRINT FILA';
    }
}

async function AlList() {
    try {
        const fila = await jsonfile.readFile(charGameDataPath);
        const list = [];
        for (const key in fila) {
            const bp = fila[key];
            if (bp.active === true) {
                const p = await getCharacterClass(bp.nome);
                if (p) list.push(p);
            }
        }
        return list;
    } catch (error) {
        console.log(error);
        console.log('ERRO EM FILA DE PRINT FILA');
        return []; // Retorna array vazio em caso de erro
    }
}

async function AllStatus() {
    try {
        const fila = await jsonfile.readFile(charGameDataPath);
        let final = '';
        for (const key in fila) {
            const bp = fila[key];
            const p = await getCharacterClass(bp.nome);
            if (p) {
                const atb = p.con + p.strOri + p.dexOri + p.intOri + p.sab + p.car + p.agiOri + p.will;
                final += `[${bp.id}] **${p.nome}** • LV: ${p.nivel} [${atb}] • ${p.playerName}\n`;
            } else {
                final += `[${bp.id}] **${bp.nome}** • (ERRO: Ficha não encontrada) • ${bp.player}\n`;
            }
        }
        return final === '' ? 'Fila Vazia!' : final;
    } catch (error) {
        console.log(error);
        console.log('ERRO EM FILA DE PRINT FILA');
        return 'ERRO EM FILA DE PRINT FILA';
    }
}

async function getAllActiveFila() {
    try {
        const fila = await jsonfile.readFile(charGameDataPath);
        return Object.values(fila).filter(bp => bp.active === true);
    } catch (error) {
        console.log(error);
        console.log('ERRO EM FILA DE PRINT FILA');
        return [];
    }
}

async function printCharList() {
    try {
        const charGameData = await jsonfile.readFile(charGameDataPath);
        let final = '';
        for (const key in charGameData) {
            final += `[${charGameData[key].id}] **${charGameData[key].nome.toUpperCase()}** | Player: ${charGameData[key].player}`;
            if (charGameData[key].active) {
                final += ' ** • > ATIVO <**';
            }
            final += '\n';
        }
        return final;
    } catch (error) {
        console.error('Algo deu errado na impressora de personagens.');
        return 'Algo deu errado na impressora de personagens.';
    }
}

async function getCharacterClass(filename) {
    const c = await readCharacterFile(filename);
    return c ? new Personagem(c) : false;
}


async function getPlayerCharacter(source) {
    try {
        // 1. Extrai o objeto do usuário de forma flexível, não importa a fonte.
        const user = source.author || source.user || source.member?.user || source;
        let character
        if (user.username === `Mob`) {
           return null
        }

        // 2. Se não encontrou um usuário ou o usuário é um bot, encerra a busca.
        if (!user || !user.id) {
            return null;
        }

        if (user.bot) {
           const isChar = await readCharacter(user.username);
           character = (isChar === 'char' ? await getCharacterClass(user.username) : false);
        } else {
            character = await readCharacterActive(user.id);
        }

        // 3. Usa o ID do usuário (permanente) para buscar o personagem. ISTO CORRIGE O BUG.

        character = await getCharacterClass(character?.nome); // Carrega a ficha completa se existir

        if (!character || character === undefined) {
            console.log(`a`)
            return null
        }

        return character; // Retorna o personagem encontrado ou null se não houver.

    } catch (error) {
        // Loga o erro para facilitar a depuração, mas não quebra o bot.
        console.error('Erro ao obter o personagem:', error);
        return null;
    }
}

async function getCharacterObjBruto(filename) {
    return readCharacterFile(filename);
}

async function active(source, args) {
    try {
        // 1. Unifica a obtenção do usuário e extrai seu ID e username.
        const user = source.author || source.user;
        const playerId = user.id;
        const playerUsername = user.username;

        if (!args || args.length === 0) {
            return `Ops! ${playerUsername}, você precisa me dizer qual personagem quer ativar.`;
        }

        const characterToActivate = normalizeName(args.join(' '));
        const charGameData = await jsonfile.readFile(charGameDataPath);

        let characterActivated = false;
        let foundCharacterName = '';

        for (const key in charGameData) {
            const character = charGameData[key];

            // 2. Verifica se o personagem pertence ao usuário (por ID ou, como fallback, por username).
            const isOwner = (character.playerId === playerId) ||
                (!character.playerId && normalizeName(character.player) === normalizeName(playerUsername));

            if (isOwner) {
                // 3. Atualiza o registro com o ID do usuário para modernizar os dados.
                character.playerId = playerId;

                if (normalizeName(character.nome) === characterToActivate) {
                    character.active = true;
                    characterActivated = true;
                    foundCharacterName = character.nome; // Guarda o nome original para a mensagem de resposta
                } else {
                    character.active = false;
                }
            }
        }

        // 4. Salva o arquivo de forma assíncrona com os dados atualizados.
        await jsonfile.writeFile(charGameDataPath, charGameData, { spaces: 2 });

        if (characterActivated) {
            return `Feito, ${playerUsername}! Seu personagem **${foundCharacterName.toUpperCase()}** está ativo.`;
        } else {
            return `Ops, ${playerUsername}! Não encontrei um personagem chamado **"${characterToActivate.toUpperCase()}"** na sua lista.`;
        }

    } catch (error) {
        console.error('ERRO AO ATIVAR PERSONAGEM:', error);
        return 'Ocorreu um erro ao tentar ativar o personagem.';
    }
}

// Função auxiliar, caso você não a tenha em escopo
function normalizeName(name) {
    return name.toLowerCase();
}

async function give(message, args) {
    try {
        const player = args[0];
        const characterPartial = args.slice(1).join(' ');
        const characterFullName = await getCharacterNomeParcial(characterPartial);

        if (!characterFullName) {
            return `Ops! Personagem não encontrado com base em '${characterPartial}'. Envie //give player [nome parcial]`;
        }

        const charGameData = await jsonfile.readFile(charGameDataPath);
        let gived = false;

        for (const key in charGameData) {
            if (normalizeName(charGameData[key].nome) === normalizeName(characterFullName)) {
                charGameData[key].player = player;
                gived = charGameData[key];
                break; // Para a busca assim que encontrar
            }
        }

        if (gived) {
            await fs.writeFileSync(charGameDataPath, JSON.stringify(charGameData, null, 2));
            return `Feito! O personagem **${gived.nome}** foi dado para *${player}*.`;
        }

        return `Ops! Personagem não encontrado. Envie //give player [nome parcial]`;
    } catch (error) {
        console.log('ERRO AO DAR PERSONAGEM.', error);
        return 'Ocorreu um erro ao dar o personagem.';
    }
}

async function printProfile(message) {
    try {
        const p = await getCharacterJson(message);
        if (!p) return 'Personagem não encontrado.';

        const normalizedFilename = normalizeName(p.nome);
        const filePath = path.join(profilesPath, `${normalizedFilename}.json`);

        if (!await fs.pathExists(filePath)) return 'Perfil não encontrado.';

        return fs.readJSON(filePath);
    } catch (error) {
        console.error('Erro em printProfile:', error);
        return 'Ocorreu um erro ao buscar o perfil.';
    }
}

async function getCharacterNomeParcial(nomeParcial) {
    try {
        const normalizedPartial = normalizeName(nomeParcial);
        const charGameData = await jsonfile.readFile(charGameDataPath);

        const found = Object.values(charGameData).find(char => normalizeName(char.nome).includes(normalizedPartial));
        return found ? found.nome : false;
    } catch (error) {
        console.error(`Erro em getCharacterNomeParcial para '${nomeParcial}':`, error);
        return false;
    }
}

async function getCharacterJson(message) {
    return getPlayerCharacter(message);
}

/**
 * @deprecated Use getPlayerCharacter() para novos códigos. Este é um alias para retrocompatibilidade.
 */
async function getCharacterClassDirect(message) {
    return getPlayerCharacter(message);
}

/**
 * @deprecated Use getPlayerCharacter() para novos códigos. Este é um alias para retrocompatibilidade.
 */
async function getCharacterClassDirectByReact(source) {
    // 'source' aqui pode ser a mensagem ou o usuário da reação
    return getPlayerCharacter(source);
}


module.exports = {
    AllActiveStatus,
    AllStatus,
    getCharacterClassDirect,
    printProfile,
    active,
    readCharacterFile,
    printCharList,
    createCharacter,
    readCharacter,
    updateCharacter,
    deleteCharacter,
    fileExists,
    getCharacterJson,
    getCharacterClass,
    getCharacterNomeParcial,
    getCharacterObjBruto,
    getAllActiveFila,
    getCharacterDatabase,
    AlList,
    getActives,
    getCharacterClassDirectByReact,
    give,
    updateCharacterSomando
};