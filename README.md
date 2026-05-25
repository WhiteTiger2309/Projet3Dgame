Mathis ANDRÉ  
Marc DI RUSSO

# Lancer le jeu

Lien vers le jeu : https://whitetiger2309.github.io/Projet3Dgame/

# Partie conception : choix techniques, justification, difficultés rencontrées, choses dont vous êtes les plus fiers.
Le jeu se joue en utilisant un clavier et une souris, le pavé tactile n’est pas adapté et la manette n’est pas supportée.
Nous sommes fiers de notre jeu, c’est pour cela que nous prévoyons de le perfectionner pour le concours. Nous avons déjà plusieurs idées d'améliorations : ajouter d’avantages des sons (pour signifier au joueur qu’il a réussi le puzzle par exemple), regrouper les puzzles entre eux (laser avec lien), ajouter une vraie fin.

## Premières idées :
Très rapidement, nous sommes parties sur l’idée d’un jeu composé de différents puzzles, dans l’esprit de Portal, mais sans le portal gun. L’objectif était de proposer plusieurs mécaniques complémentaires, afin de garder un rythme varié tout au long du jeu. Cette logique se retrouve dans plusieurs cartes et systèmes, notamment src/js/MapLab.js, src/js/MapLazer.js, src/js/MapPuzzle1.js, src/js/MapPuzzle2.js et src/js/ElectricPuzzle.js. 
Première image du prototype du jeu :

<p align="center"><img src="public\images\readme\image7.png" width="50%"></p>  

L’une des grandes questions a été de savoir comment respecter le thème IA. Une première idée a été d’ajouter un boss de fin, mais elle a rapidement été abandonnée car trop complexe pour le temps disponible. Nous avons finalement choisi une approche plus simple et plus réaliste: introduire un petit robot en 3D, utilisé comme élément narratif et interactif. Ce choix est visible dans src/js/Robot.js et dans le système de dialogue associé via src/js/DialogManager.js. Cela permet de donner une présence au thème IA sans surcharger la structure du jeu. 

<p align="center"><img src="public\images\readme\image8.png" width="30%"></p>  

Une autre idée abandonnée était de faire apporter des objets au robot pour qu’il améliore le joueur. Cette piste nous a aidées à explorer plusieurs directions de gameplay, mais elle a été écartée pour rester concentrée sur une boucle de jeu plus claire. 

Sous les conseils de monsieur Buffa, nous avons ajouté un fog sur la carte afin de renforcer l’ambiance et d’atténuer les détails lointains. Dans le code, cela passe par src/js/CreateMap.js, avec un fog exponentiel et une densité animée. Ce choix a un double intérêt: il améliore l’atmosphère générale et il permet aussi de limiter l’impact visuel des textures et objets éloignés. 
Nous avons également décidé d’ajouter un menu, géré dans index.html et src/js/Main.js, ainsi que deux musiques distinctes, une pour le menu et une pour la phase de jeu, prises en charge par src/js/utils/SoundManager.js, afin de renforcer l’immersion du joueur dès l’accueil puis pendant la partie.
Nous avons ajouté des effets lumineux sur les murs pour donner un aspect plus futuriste au jeu :

<p align="center"><img src="public\images\readme\image6.png" width="50%"></p>  


## Une des versions de la map non gardée :

<p align="center"><img src="public\images\readme\image5.png" width="50%"></p>  


Nous avons essayé de créer différents puzzles amusants et variés pour le joueur:
déplacer un cube et le poser sur une dalle pour ouvrir une porte;
utiliser un grappin pour certains déplacements;
orienter un laser fixe vers un capteur pour ouvrir une porte;
utiliser un système de miroir pour dévier un laser;
relier des interrupteurs à des portes grâce à un système de connexion;
résoudre un puzzle électrique où il faut faire circuler du courant entre une source et une destination.
Le projet ne repose pas sur une seule idée, mais sur plusieurs systèmes complémentaires. Le système de connexion entre objets, visible dans src/js/ConnectionManager.js et dans les objets connectables de src/js/ConnectableObjects, est particulièrement intéressant car il permet de construire des énigmes de manière réutilisable. Le puzzle électrique, lui, ajoute une logique différente basée sur la propagation d’énergie et les états des objets.

## Relier un interrupteur à une porte :

<p align="center"><img src="public\images\readme\image3.png" width="50%"></p>  

## Emetteur laser :

<p align="center"><img src="public\images\readme\image2.png" width="50%"></p>  


## Laser réfléchie sur un miroir :

<p align="center"><img src="public\images\readme\image1.png" width="50%"></p>  






## Difficultées rencontrés :
Nous avons eu du mal à stabiliser une idée claire pour la boucle de jeu. Plusieurs concepts ont été testés, puis abandonnés ou simplifiés, avant d’aboutir à une structure plus cohérente. 


## Ce dont on est le plus fiers :
Nous sommes particulièrement fiers des déplacements du joueur et de ses collisions, qui reposent sur Havok et donnent une sensation de contrôle plus propre et plus crédible. Le moteur de physique est initialisé dans src/js/Main.js, tandis que le comportement du joueur est concentré dans src/js/Player.js.
Nous sommes aussi fiers du chargeur central d’assets. Le projet utilise src/js/utils/AssetsLoader.js pour précharger les modèles, textures et sons, ce qui permet d’éviter les temps de chargement visibles pendant la partie et de garder une expérience plus fluide.
La partie sonore est aussi un point fort. La musique d’ambiance est préchargée et des mécanismes de secours ont été prévus pour que le son fonctionne malgré les restrictions des navigateurs. Les bruits de pas sont gérés séparément de la musique, ce qui rend l’immersion plus naturelle.
Enfin, nous sommes fières de la caméra subjective, parentée au personnage, qui donne une vue FPS claire et lisible. Cela renforce l’immersion et s’intègre bien au système d’interaction du joueur, notamment pour les rayons de sélection et les puzzles. 

<p align="center"><img src="public\images\readme\image4.png" width="50%"></p>  



