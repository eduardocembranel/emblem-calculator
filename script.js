const itemsDiv = document.getElementById("items");
const addItemBtn = document.getElementById("addItem");
const removeItemBtn = document.getElementById("removeItem");
const calculateBtn = document.getElementById("calculate");
const resultsPre = document.getElementById("results");

// Function to add a select item (1 to 5)
function addItemField(selectedValue = 1) {
    const selects = itemsDiv.querySelectorAll("select");
    if (selects.length >= 5) return; // max 5 items
    const select = document.createElement("select");
    for (let i = 1; i <= 5; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = i;
        if (i === selectedValue) option.selected = true;
        select.appendChild(option);
    }
    itemsDiv.appendChild(select);
}

// Add item
addItemBtn.addEventListener("click", () => addItemField());

// Remove last item
removeItemBtn.addEventListener("click", () => {
    const selects = itemsDiv.querySelectorAll("select");
    if (selects.length <= 2) return; // min 2 items
    selects[selects.length - 1].remove();
});

// Initialize with 5 items
for (let i = 0; i < 5; i++) addItemField();


// Calculate results
calculateBtn.addEventListener("click", () => {
    const operation = document.querySelector("input[name='operation']:checked").value;
    const items = Array.from(itemsDiv.querySelectorAll("select")).map(s => parseInt(s.value));

    const numSimulations = 100000
    const result = runSimulation(items, operation, numSimulations);

    if (result.error) {
        resultsPre.innerHTML = `<span style="color:red; font-weight:bold;">Erro: ${result.error}</span>`;
    } else {
        let output =
            `<strong>Número de simulações executadas:</strong> ${numSimulations}<br><br>` +
            `<strong>Chance de melhorar:</strong> <span style="color:green">${result.improveChance}%</span><br>` +
            `<strong>Chance de não piorar:</strong> ${result.improveOrEqualChance}%<br>` +
            `<strong>Chance de piorar:</strong> <span style="color:red">${result.worsenChance}%</span><br><br>`;

        if (result.meanBonusInImproves !== null) {
            const improveGain = (result.meanBonusInImproves - result.totalBonusInitial).toFixed(2);
            output += `<span style="color:green">Ganho médio em melhorias:</span> ${result.totalBonusInitial} → ${result.meanBonusInImproves} (+${improveGain})<br>`;
        }

        if (result.meanBonusInWorsen !== null) {
            const worsenLoss = (result.totalBonusInitial - result.meanBonusInWorsen).toFixed(2);
            output += `<span style="color:red">Perda média em pioras:</span> ${result.totalBonusInitial} → ${result.meanBonusInWorsen} (-${worsenLoss})<br>`;
        }

        resultsPre.innerHTML = output;
    }
});

function runSimulation(qualitiesInitial, operation, numSimulations) {
    const n = qualitiesInitial.length;
    let simulations;

    if (operation === "reroll") {
        simulations = makeSimulationsReroll(n, numSimulations);
    } else if (operation === "increaseTwoDecreaseOne") {
        // Validation: must have at least 3 items
        if (n < 3) {
            return { error: "É necessário ter pelo menos 3 emblemas para realizar esta operação" };
        }

        const count5 = qualitiesInitial.filter(q => q === 5).length;
        if (count5 >= n - 1) {
            return { error: `Não é possivel melhorar pois já existe(m) ${count5} emblema(s) com qualidade 5` };
        }

        simulations = makeSimulationsIncreaseTwoDecreaseOne(qualitiesInitial, numSimulations);
    } else {
        return { error: "Operação inválida" };
    }

    return calculateImproveChances(qualitiesInitial, simulations);
}


function makeSimulationsReroll(n, numSimulations) {
    const simulations = [];
    for (let i = 0; i < numSimulations; i++) {
        const sim = Array.from({ length: n }, () => Math.floor(Math.random() * 5) + 1);
        simulations.push(sim);
    }
    return simulations;
}

function makeSimulationsIncreaseTwoDecreaseOne(initialQualities, numSimulations) {
    const simulations = [];
    for (let i = 0; i < numSimulations; i++) {
        const endQualities = applyIncreaseTwoDecreaseOne(initialQualities);
        simulations.push(endQualities);
    }
    return simulations;
}

function applyIncreaseTwoDecreaseOne(qualities) {
    const n = qualities.length;
    const newQualities = [...qualities];

    let indicesToIncrease = [];
    const candidatesToIncrease = newQualities
        .map((q, i) => i)
        .filter(i => newQualities[i] < 5);

    // special case: only one element different than 1
    if (qualities.filter(q => q === 1).length === n - 1) {
        indicesToIncrease = newQualities
            .map((q, i) => i)
            .filter(i => newQualities[i] === 1)
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);
    } else {
        indicesToIncrease = candidatesToIncrease.sort(() => 0.5 - Math.random()).slice(0, 2);
    }

    // candidates for decrease
    const candidateDecreaseIndices = newQualities
        .map((q, i) => i)
        .filter(i => newQualities[i] > 1 && !indicesToIncrease.includes(i));

    if (candidateDecreaseIndices.length > 0) {
        const indexToDecrease = candidateDecreaseIndices[Math.floor(Math.random() * candidateDecreaseIndices.length)];
        newQualities[indexToDecrease] = Math.floor(Math.random() * (newQualities[indexToDecrease] - 1)) + 1;
    }

    for (const i of indicesToIncrease) {
        newQualities[i] = Math.floor(Math.random() * (5 - newQualities[i])) + newQualities[i] + 1;
    }

    return newQualities;
}

function calculateImproveChances(qualitiesInitial, simulations) {
    let countImproves = 0;
    let countEqual = 0;
    let countWorsen = 0;
    let bonusInImproves = 0;
    let bonusInWorsen = 0;

    const totalBonusInitial = qualitiesInitial.reduce((acc, q) => acc + getRawBonus(q), 0);

    for (const sim of simulations) {
        const totalBonusSim = sim.reduce((acc, q) => acc + getRawBonus(q), 0);
        if (totalBonusSim > totalBonusInitial) {
            countImproves++;
            bonusInImproves += totalBonusSim;
        } else if (totalBonusSim === totalBonusInitial) {
            countEqual++;
        } else {
            countWorsen++;
            bonusInWorsen += totalBonusSim;
        }
    }

    const improveChance = (countImproves / simulations.length) * 100;
    const improveOrEqualChance = ((countImproves + countEqual) / simulations.length) * 100;
    const worsenChance = 100 - improveOrEqualChance;

    const meanBonusInImproves = countImproves !== 0 ? bonusInImproves / countImproves : null;
    const meanBonusInWorsen = countWorsen !== 0 ? bonusInWorsen / countWorsen : null;

    return {
        improveChance: parseFloat(improveChance.toFixed(2)),
        improveOrEqualChance: parseFloat(improveOrEqualChance.toFixed(2)),
        worsenChance: parseFloat(worsenChance.toFixed(2)),
        totalBonusInitial: parseFloat(totalBonusInitial.toFixed(2)),
        meanBonusInImproves: meanBonusInImproves !== null ? parseFloat(meanBonusInImproves.toFixed(2)) : null,
        meanBonusInWorsen: meanBonusInWorsen !== null ? parseFloat(meanBonusInWorsen.toFixed(2)) : null
    };
}

function getRawBonus(quality) {
    const bonus = [10, 30, 60, 100, 150];
    return bonus[quality - 1];
}
