// Firebase shared dashboard setup
const firebaseConfig = {
  apiKey: "AIzaSyBbNJSWzZaUpt1CrRlZVATjWHyFDrNxXFY",
  authDomain: "brownie-dashboard-e8817.firebaseapp.com",
  projectId: "brownie-dashboard-e8817",
  storageBucket: "brownie-dashboard-e8817.firebasestorage.app",
  messagingSenderId: "429293775189",
  appId: "1:429293775189:web:5e9c54dc789331230727dc"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const stateDoc = db.collection('dashboard').doc('state');
const transactionCollection = stateDoc.collection('transactions');

let points1 = 0;
let points2 = 0;
let transactions = [];

// Display initial points
const points1Element = document.getElementById('points1');
const points2Element = document.getElementById('points2');

points1Element.textContent = 0;
points2Element.textContent = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (firebase.auth) {
        firebase.auth().signInAnonymously()
            .then(() => {
                initSharedData();
            })
            .catch((error) => {
                console.error('Anonymous auth failed:', error);
                // Proceed to init anyway — will likely hit permission errors if rules require auth
                initSharedData();
            });
    } else {
        initSharedData();
    }
});

function initSharedData() {
    stateDoc.get().then((doc) => {
        if (!doc.exists) {
            stateDoc.set({ points1: 0, points2: 0 });
        }
    });

    stateDoc.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            points1 = data.points1 || 0;
            points2 = data.points2 || 0;
            points1Element.textContent = points1;
            points2Element.textContent = points2;
        }
    });

    transactionCollection.orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        transactions = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                user: data.user,
                userName: data.userName,
                action: data.action,
                points: data.points,
                reason: data.reason,
                timestamp: data.timestamp ? data.timestamp.toDate().toLocaleString() : '',
                pointsBefore: data.pointsBefore
            };
        });
        displayTransactions();
    });
}

function addTransaction(user, action, points, reason = '') {
    const userName = user === 1 ? 'Rahul' : 'Pavani';
    const currentPoints = user === 1 ? points1 : points2;
    const nextPoints = currentPoints + points;
    const transaction = {
        user: user,
        userName: userName,
        action: action,
        points: points,
        reason: reason,
        timestamp: firebase.firestore.Timestamp.now(),
        pointsBefore: currentPoints
    };

    const batch = db.batch();
    const txRef = transactionCollection.doc();
    batch.set(txRef, transaction);
    if (user === 1) {
        batch.set(stateDoc, { points1: nextPoints }, { merge: true });
    } else {
        batch.set(stateDoc, { points2: nextPoints }, { merge: true });
    }
    return batch.commit();
}

function displayTransactions() {
    const container = document.getElementById('historyContainer');
    if (transactions.length === 0) {
        container.innerHTML = '<p>No transactions yet</p>';
        return;
    }
    let html = '';
    transactions.forEach((t) => {
        const reasonText = t.reason ? ` (${t.reason})` : '';
        html += `<div class="transaction">
            <span class="transaction-user">${t.userName}</span>
            <span class="transaction-action">${t.action}</span>
            <span class="transaction-points">${t.points > 0 ? '+' : ''}${t.points}</span>
            <span class="transaction-reason">${reasonText}</span>
            <span class="transaction-time">${t.timestamp}</span>
        </div>`;
    });
    container.innerHTML = html;
}

function undoLastTransaction(user) {
    transactionCollection
        .where('user', '==', user)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                alert('No transaction available to undo.');
                return;
            }
            const txDoc = snapshot.docs[0];
            const txData = txDoc.data();
            const batch = db.batch();
            batch.delete(txDoc.ref);
            if (user === 1) {
                batch.set(stateDoc, { points1: txData.pointsBefore }, { merge: true });
            } else {
                batch.set(stateDoc, { points2: txData.pointsBefore }, { merge: true });
            }
            return batch.commit().then(() => {
                alert(`Undid ${txData.userName}'s last transaction: ${txData.action} ${txData.points > 0 ? '+' : ''}${txData.points}`);
            });
        })
        .catch((error) => {
            console.error('Undo failed:', error);
            alert('Unable to undo transaction.');
        });
}

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    let user = null;
    if (e.target.closest('#user1')) {
        user = 1;
    } else if (e.target.closest('#user2')) {
        user = 2;
    }
    if (user) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.innerHTML = `<div class="context-item" onclick="undoLastTransaction(${user}); this.parentElement.remove();">Undo</div>`;
        document.body.appendChild(contextMenu);
        document.addEventListener('click', function removeMenu() {
            contextMenu.remove();
            document.removeEventListener('click', removeMenu);
        });
    }
});

const currentAction = { 1: null, 2: null };

function setPointEntryMode(user, show, action = null) {
    const pointsInput = document.getElementById('redeemPoints' + user);
    const descInput = document.getElementById('redeemDesc' + user);
    const pointsLabel = document.querySelector('#user' + user + ' label[for="redeemPoints' + user + '"]');
    const descLabel = document.querySelector('#user' + user + ' label[for="redeemDesc' + user + '"]');
    const controlBtn = document.querySelector('#user' + user + ' .redeem button');
    const backBtn = document.querySelector('#user' + user + ' .back-btn');
    const addBtn = document.querySelector('#user' + user + ' .add-btn');
    const subtractBtn = document.querySelector('#user' + user + ' .subtract-btn');

    if (show) {
        currentAction[user] = action;
        pointsInput.style.display = 'inline-block';
        pointsLabel.style.display = 'block';
        controlBtn.textContent = 'Confirm';
        backBtn.style.display = 'inline-block';
        addBtn.style.display = 'none';
        subtractBtn.style.display = 'none';

        if (action === 'redeem') {
            descInput.style.display = 'inline-block';
            descLabel.style.display = 'block';
        } else {
            descInput.style.display = 'none';
            descLabel.style.display = 'none';
        }
    } else {
        currentAction[user] = null;
        pointsInput.style.display = 'none';
        descInput.style.display = 'none';
        pointsLabel.style.display = 'none';
        descLabel.style.display = 'none';
        controlBtn.textContent = 'Redeem';
        backBtn.style.display = 'none';
        addBtn.style.display = 'inline-block';
        subtractBtn.style.display = 'inline-block';
        pointsInput.value = '';
        descInput.value = '';
    }
}

function addPoints(user) {
    setPointEntryMode(user, true, 'add');
}

function subtractPoints(user) {
    setPointEntryMode(user, true, 'subtract');
}

function addGymPoints(user) {
    const amount = user === 1 ? 1 : 2;
    addTransaction(user, 'Gym', amount).catch((error) => {
        console.error('Gym update failed:', error);
    });
}

function cancelPointAction(user) {
    setPointEntryMode(user, false);
}

function confirmAction(user) {
    const action = currentAction[user];
    const pointsInput = document.getElementById('redeemPoints' + user);
    const descInput = document.getElementById('redeemDesc' + user);
    let amount = parseInt(pointsInput.value, 10);
    if (isNaN(amount)) {
        amount = 1; // default to 1 when user doesn't enter a value
    }
    const currentPoints = user === 1 ? points1 : points2;

    if (!action) {
        setPointEntryMode(user, true, 'redeem');
        return;
    }

    if (amount <= 0) {
        alert('Please enter a valid number of points.');
        return;
    }

    if (action === 'add') {
        addTransaction(user, 'Add Points', amount)
            .then(() => setPointEntryMode(user, false))
            .catch((error) => {
                console.error('Add Points failed:', error);
            });
        return;
    }

    if (action === 'subtract') {
        addTransaction(user, 'Subtract Points', -amount)
            .then(() => setPointEntryMode(user, false))
            .catch((error) => {
                console.error('Subtract Points failed:', error);
            });
        return;
    }

    const description = descInput.value.trim();
    // Allow negative points for redeem as well

    if (!description) {
        alert('Please enter a reason.');
        return;
    }

    addTransaction(user, 'Redeem', -amount, description)
        .then(() => {
            alert(`Redeemed ${amount} points for: ${description}`);
            setPointEntryMode(user, false);
        })
        .catch((error) => {
            console.error('Redeem failed:', error);
        });
}
